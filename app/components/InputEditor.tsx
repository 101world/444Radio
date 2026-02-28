'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Square, Search, Zap, Volume2, ChevronDown, Sparkles, Copy, Check, Palette, Plus, Undo2, Redo2, BookOpen, FolderOpen, Save, Download, Upload, Trash2, Pencil, Files, AlertTriangle, MessageCircle, Send, Loader2, Mic, CircleDot, LayoutGrid, Columns, LayoutList, Maximize2, Minimize2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
const NodeEditor = lazy(() => import('./NodeEditor'))
const SoundUploader = lazy(() => import('./node-editor/SoundUploader'))
import ReleasePatternModal from './ReleasePatternModal'
import type { NodeEditorHandle } from './NodeEditor'

// ─── Saved Pattern type ───
interface SavedPattern {
  id: string
  name: string
  code: string
  createdAt: number
  updatedAt: number
}

const PATTERNS_STORAGE_KEY = '444-saved-patterns'
const PATTERNS_SEEDED_KEY = '444-patterns-seeded'

// ─── Default starter patterns (show on first visit) ───
const DEFAULT_PATTERNS: SavedPattern[] = [
  {
    id: 'default_lofi_beat',
    name: 'lofi chill beat',
    code: `// lofi chill beat
let drums = s("bd ~ [~ bd] ~, ~ cp ~ ~, [hh hh] [hh hh] [hh hh] [hh oh]")
  .bank("RolandTR808").gain(0.8)
let melody = note("<c3 a2 f2 g2>").sound("sawtooth")
  .lpf(600).gain(0.4).slow(2)

$: arrange(
  [2, drums],
  [4, stack(drums, melody)])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_synth_pad',
    name: 'ambient pad drift',
    code: `// ambient pad drift
let melody = note("<c3,e3,g3 a2,c3,e3 f2,a2,c3 g2,b2,d3>")
  .sound("sawtooth").lpf(sine.range(400,1500).slow(8))
  .room(0.9).roomsize(4).gain(0.35).slow(2)

$: arrange([4, melody])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_dnb_pattern',
    name: 'jungle breaks',
    code: `// jungle breaks
let drums = s("bd [~ bd] [~ bd:2] ~, ~ [~ cp] ~ cp, hh*8")
  .bank("RolandTR909").fast("<1 1 1.5 1>").gain(0.9)
let melody = note("<e2 [e2 g2] a2 [g2 ~]>")
  .sound("sawtooth").lpf(900).gain(0.5)

$: arrange(
  [2, drums],
  [4, stack(drums, melody)])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_techno_driver',
    name: 'techno 4/4',
    code: `// techno 4/4
let kick = s("bd*4").bank("RolandTR909").gain(1)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(0.7)
let hats = s("hh*8").gain("0.4 0.2 0.6 0.2 0.4 0.2 0.8 0.2")
  .bank("RolandTR909")
let melody = note("<c2 c2 [c2 c3] c2>").sound("sawtooth")
  .lpf(sine.range(200,3000).slow(16)).gain(0.5)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, melody)])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_piano_melody',
    name: 'piano with reverb',
    code: `// piano with reverb
note("c4 e4 g4 b4 a4 g4 e4 c4")
  .sound("piano").room(0.7).roomsize(3)
  .gain(0.6).slow(2)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_808_trap',
    name: '808 trap groove',
    code: `// 808 trap groove
let drums = s("bd ~ ~ bd, ~ ~ cp ~, hh*4 [hh oh] hh*4 [hh oh]")
  .bank("RolandTR808").gain(0.85)
let melody = note("<c2 ~ [c2 c2] ~ , ~ eb2 ~ ~>")
  .sound("square").lpf(400).decay(0.3).gain(0.6)

$: arrange(
  [2, drums],
  [4, stack(drums, melody)])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_euclidean',
    name: 'euclidean polyrhythm',
    code: `// euclidean polyrhythm
let kick = s("bd(3,8)").bank("RolandTR808").gain(0.9)
let clap = s("cp(2,5)").bank("RolandTR909").gain(0.6)
let hats = s("hh(5,8)").gain(0.4)
let openHat = s("oh(3,8,2)").gain(0.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, openHat)])`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_generative',
    name: 'generative ambient',
    code: `// generative ambient
note("<c3 d3 e3 f3 g3 a3 b3>".pick())
  .sound("triangle")
  .lpf(sine.range(300,2000).slow(6))
  .room(0.95).roomsize(6)
  .delay(0.6).gain(0.4)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
]

function loadPatternsFromStorage(): SavedPattern[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PATTERNS_STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    // First visit: seed with default patterns
    if (!localStorage.getItem(PATTERNS_SEEDED_KEY)) {
      localStorage.setItem(PATTERNS_SEEDED_KEY, '1')
      savePatternsToStorage(DEFAULT_PATTERNS)
      return [...DEFAULT_PATTERNS]
    }
    return []
  } catch { return [] }
}

function savePatternsToStorage(patterns: SavedPattern[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PATTERNS_STORAGE_KEY, JSON.stringify(patterns))
}

// Strudel CDN (same CDN used by strudel.cc)
const STRUDEL_CDN = 'https://strudel.b-cdn.net'

// ─── Strudel Themes (extracted from @strudel/codemirror/themes) ───
interface ThemeColors {
  background: string
  foreground: string
  caret: string
  gutterForeground: string
  lineHighlight: string
  light?: boolean
}

const STRUDEL_THEMES: Record<string, ThemeColors> = {
  '444 Radio': { background: '#000000', foreground: '#4ade80', caret: '#4ade80', gutterForeground: '#8a919966', lineHighlight: '#ffffff10' },
  'Algoboy': { background: '#0F0A0A', foreground: '#6B4747', caret: '#996666', gutterForeground: '#996666', lineHighlight: '#0F0A0A90' },
  'Android Studio': { background: '#282b2e', foreground: '#a9b7c6', caret: '#a9b7c6', gutterForeground: '#cccccc50', lineHighlight: '#282b2e99' },
  'Arch Btw': { background: 'rgb(0, 0, 0)', foreground: 'rgb(82, 208, 250)', caret: 'rgb(82, 208, 250)', gutterForeground: 'rgba(113, 208, 250, .4)', lineHighlight: 'transparent' },
  'Atom One': { background: '#272C35', foreground: 'hsl(220, 14%, 71%)', caret: 'hsl(286, 60%, 67%)', gutterForeground: '#465063', lineHighlight: '#272C3599' },
  'Aura': { background: '#21202e', foreground: '#edecee', caret: '#a277ff', gutterForeground: '#edecee', lineHighlight: '#3d375e7f' },
  'BBEdit': { background: '#FFFFFF', foreground: '#000000', caret: '#0000FF', gutterForeground: '#4D4D4C', lineHighlight: '#FFFFFF99', light: true },
  'Black Screen': { background: 'black', foreground: 'white', caret: 'white', gutterForeground: '#8a919966', lineHighlight: '#00000050' },
  'Blue Screen': { background: '#051DB5', foreground: 'white', caret: 'white', gutterForeground: '#8a919966', lineHighlight: '#051DB550' },
  'Blue Screen Light': { background: 'rgb(75, 130, 247)', foreground: 'rgb(255, 255, 255)', caret: 'rgb(255, 255, 255)', gutterForeground: 'rgb(255, 255, 255)', lineHighlight: 'transparent', light: true },
  'Cutie Pi': { background: 'white', foreground: '#5c019a', caret: '#5c019a', gutterForeground: '#465063', lineHighlight: '#fbeffc', light: true },
  'Darcula': { background: '#242424', foreground: '#f8f8f2', caret: '#CC7832', gutterForeground: '#999', lineHighlight: '#24242499' },
  'Dracula': { background: '#282a36', foreground: '#f8f8f2', caret: '#ff79c6', gutterForeground: '#6272a4', lineHighlight: '#282a3699' },
  'Duotone Dark': { background: '#2a2734', foreground: '#eeebff', caret: '#ffcc99', gutterForeground: '#545167', lineHighlight: '#2a273499' },
  'Duotone Light': { background: '#faf8f5', foreground: '#b29762', caret: '#063289', gutterForeground: '#cdc4b1', lineHighlight: '#faf8f599', light: true },
  'Eclipse': { background: '#fff', foreground: '#000', caret: '#7F0055', gutterForeground: '#999', lineHighlight: '#ffffff99', light: true },
  'Fruit DAW': { background: 'rgb(84, 93, 98)', foreground: 'rgb(167, 216, 177)', caret: 'rgb(252, 184, 67)', gutterForeground: 'rgba(255, 255, 255, .25)', lineHighlight: 'transparent' },
  'GitHub Dark': { background: '#0d1117', foreground: '#c9d1d9', caret: '#ff7b72', gutterForeground: '#c9d1d9', lineHighlight: '#0d111799' },
  'GitHub Light': { background: '#fff', foreground: '#24292e', caret: '#d73a49', gutterForeground: '#6e7781', lineHighlight: '#ffffff99', light: true },
  'Green Text': { background: '#000000', foreground: '#56bd2a', caret: '#8ed675', gutterForeground: '#54636D', lineHighlight: 'transparent' },
  'Gruvbox Dark': { background: '#282828', foreground: '#ebdbb2', caret: '#fb4934', gutterForeground: '#7c6f64', lineHighlight: '#28282899' },
  'Gruvbox Light': { background: '#fbf1c7', foreground: '#3c3836', caret: '#9d0006', gutterForeground: '#665c54', lineHighlight: '#fbf1c799', light: true },
  'Material Dark': { background: '#212121', foreground: '#bdbdbd', caret: '#cf6edf', gutterForeground: '#999', lineHighlight: '#21212199' },
  'Material Light': { background: '#FAFAFA', foreground: '#90A4AE', caret: '#39ADB5', gutterForeground: '#90A4AE', lineHighlight: '#FAFAFA99', light: true },
  'Monokai': { background: '#272822', foreground: '#FFFFFF', caret: '#f92672', gutterForeground: '#FFFFFF70', lineHighlight: '#27282299' },
  'Noctis Lilac': { background: '#f2f1f8', foreground: '#0c006b', caret: '#ff5792', gutterForeground: '#0c006b70', lineHighlight: '#f2f1f899', light: true },
  'Nord': { background: '#2e3440', foreground: '#FFFFFF', caret: '#5e81ac', gutterForeground: '#4c566a', lineHighlight: '#2e344099' },
  'Red Text': { background: '#000000', foreground: '#bd312a', caret: '#ff5356', gutterForeground: '#54636D', lineHighlight: 'transparent' },
  'Solarized Dark': { background: '#002b36', foreground: '#93a1a1', caret: '#859900', gutterForeground: '#839496', lineHighlight: '#002b3699' },
  'Solarized Light': { background: '#fdf6e3', foreground: '#657b83', caret: '#859900', gutterForeground: '#657b83', lineHighlight: '#fdf6e399', light: true },
  'Sonic Pink': { background: '#000000', foreground: '#ededed', caret: '#ff1493', gutterForeground: '#cccccc', lineHighlight: 'transparent' },
  'Sublime': { background: '#303841', foreground: '#FFFFFF', caret: '#B78FBA', gutterForeground: '#FFFFFF70', lineHighlight: '#30384199' },
  'Teletext': { background: '#000000', foreground: '#6edee4', caret: '#f8fc55', gutterForeground: '#8a919966', lineHighlight: '#00000040' },
  'Terminal': { background: 'black', foreground: '#41FF00', caret: '#41FF00', gutterForeground: '#8a919966', lineHighlight: 'black' },
  'Tokyo Night': { background: '#1a1b26', foreground: '#787c99', caret: '#bb9af7', gutterForeground: '#787c99', lineHighlight: '#1a1b2699' },
  'Tokyo Night Day': { background: '#e1e2e7', foreground: '#3760bf', caret: '#007197', gutterForeground: '#3760bf', lineHighlight: '#e1e2e799', light: true },
  'Tokyo Night Storm': { background: '#24283b', foreground: '#7982a9', caret: '#bb9af7', gutterForeground: '#7982a9', lineHighlight: '#24283b99' },
  'VS Code Dark': { background: '#1e1e1e', foreground: '#fff', caret: '#569cd6', gutterForeground: '#838383', lineHighlight: '#1e1e1e99' },
  'VS Code Light': { background: '#ffffff', foreground: '#383a42', caret: '#0000ff', gutterForeground: '#237893', lineHighlight: '#ffffff50', light: true },
  'White Screen': { background: 'white', foreground: 'black', caret: 'black', gutterForeground: 'black', lineHighlight: '#ffffff50', light: true },
  'Xcode Light': { background: '#fff', foreground: '#3D3D3D', caret: '#aa0d91', gutterForeground: '#AFAFAF', lineHighlight: '#ffffff99', light: true },
}

const THEME_KEYS = Object.keys(STRUDEL_THEMES)

// Sound filter tabs (matches strudel.cc panel)
const SOUND_FILTERS = ['samples', 'drum-machines', 'synths', 'wavetables'] as const
type SoundFilter = typeof SOUND_FILTERS[number]

interface SoundEntry {
  name: string
  count: number
  type: string
  tag?: string
}

// ─── Curated Strudel Examples (from strudel.cc & examples.mjs) ───
const EXAMPLE_CATEGORIES = [
  {
    category: 'Drums & Beats',
    icon: '🥁',
    examples: [
      {
        label: '909 House',
        code: `// classic four-on-floor
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[~ hh]*4").bank("RolandTR909")
  .gain("[.4 .7 .5 .8]")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: '808 Trap',
        code: `// 808 trap groove
let kick = s("bd ~ ~ bd ~ ~ bd ~")
  .bank("RolandTR808").gain(.9)
let clap = s("~ ~ ~ ~ ~ ~ ~ cp")
  .bank("RolandTR808").gain(.7)
let hats = s("hh*8").bank("RolandTR808")
  .gain("[.3 .6 .4 .8 .3 .7 .4 .9]")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Boom Bap',
        code: `// boom bap classic
let kick = s("bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
let snare = s("~ sd ~ sd")
  .bank("RolandTR808").gain(.7)
let hats = s("[hh hh] [hh oh] [hh hh] [hh ~]")
  .bank("RolandTR808").gain(.45)

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, hats)])`,
      },
      {
        label: 'UK Garage',
        code: `// 2-step garage
let kick = s("bd ~ [~ bd] ~")
  .bank("RolandTR909").gain(.8)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[hh hh hh ~]*2")
  .bank("RolandTR909").gain(.5)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'DnB Roller',
        code: `// drum and bass pattern
let kick = s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
let snare = s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
let hats = s("hh*8").gain("[.3 .6 .35 .7 .3 .6 .35 .8]")

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, hats)])`,
      },
      {
        label: 'Clap Stack',
        code: `// layered clap patterns
let kick = s("bd*4").bank("RolandTR909").gain(.8)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.7)
let clap2 = s("~ ~ cp:2 ~").bank("RolandTR808").gain(.4)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.5)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, clap2)],
  [4, stack(kick, clap, clap2, hats)])`,
      },
      {
        label: 'Syncopated Claps',
        code: `// off-beat clap groove
let kick = s("bd ~ bd ~").bank("RolandTR808").gain(.8)
let clap = s("~ cp ~ [~ cp]").bank("RolandTR808")
  .gain(.65).room(.2)
let hats = s("[hh hh hh oh]*2")
  .bank("RolandTR808").gain(.4)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Techno Driver',
        code: `// driving techno kick
let kick = s("bd*4").gain(.9)
let clap = s("~ ~ cp ~").gain(.5).room(.3)
let hats = s("[~ hh]*4").gain(.4)
let openHat = s("~ ~ ~ oh").gain(.35)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, openHat)])`,
      },
      {
        label: 'Euclidean Poly',
        code: `// euclidean polyrhythm
let kick = s("bd(3,8)").gain(.8)
let clap = s("cp(5,8)").gain(.5).room(.2)
let hats = s("hh(7,8)").gain(.4)
let openHat = s("oh(2,8)").gain(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, openHat)])`,
      },
      {
        label: 'Afrobeat Poly',
        code: `// afrobeat polyrhythm
let kick = s("bd(3,8)").bank("RolandTR808").gain(.8)
let rim = s("rim(5,8)").bank("RolandTR808").gain(.45)
let hats = s("hh(7,16)").bank("RolandTR808")
  .gain("[.3 .5]*8")
let clap = s("cp(2,8)").bank("RolandTR808").gain(.5)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, clap)])`,
      },
      {
        label: 'Reggaeton',
        code: `// dembow riddim
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.85)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
let hats = s("[hh hh]*4").gain("[.3 .5]*4")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Chopped Breaks',
        code: `// chopped breakbeat
let kick = s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
let snare = s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)
let hats = s("hh*8")
  .gain("[.35 .6 .4 .7 .35 .6 .4 .75]")

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, hats)])`,
      },
      {
        label: 'Minimal Click',
        code: `// minimal click hat groove
let kick = s("bd ~ ~ ~, ~ ~ bd ~").gain(.75)
let rim = s("~ rim ~ rim").gain(.3)
let hats = s("hh*16").gain("[.2 .35]*8")

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, hats)])`,
      },
      {
        label: 'Stuttered Kick',
        code: `// rapid kick stutter
let kick = s("[bd bd ~] [~ bd bd] [bd ~ ~] [bd bd bd]")
  .gain(.8)
let clap = s("~ cp ~ ~").gain(.6)
let hats = s("[~ hh]*4").gain(.45)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Rim Rider',
        code: `// rim-driven pattern
let kick = s("bd ~ ~ bd ~ bd ~ ~").gain(.8)
let rim = s("rim*8").gain("[.2 .4 .25 .5 .2 .45 .25 .55]")
let clap = s("~ ~ cp ~").gain(.55)

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, clap)])`,
      },
      {
        label: 'Latin Clave',
        code: `// son clave rhythm
let kick = s("bd ~ ~ bd ~ bd ~ ~")
  .bank("RolandTR808").gain(.8)
let rim = s("rim ~ rim ~ ~ rim ~ ~")
  .bank("RolandTR808").gain(.4)
let clap = s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.5)

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, clap)])`,
      },
      {
        label: 'Clap Delay',
        code: `// echoing claps
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.6)
  .delay(.4).delayfeedback(.5)
  .room(.3)
let hats = s("[~ hh]*4").gain(.4)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Triplet Hats',
        code: `// triplet hi-hat groove
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("hh*12").bank("RolandTR909")
  .gain("[.3 .2 .4]*4")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Open Hat Groove',
        code: `// open hat accents
let kick = s("bd ~ bd ~").gain(.8)
let snare = s("~ sd ~ sd").gain(.65)
let hats = s("[hh hh oh ~]*2").gain(.5)
let clap = s("~ ~ ~ cp").gain(.4).room(.2)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, clap)])`,
      },
      {
        label: 'Double Clap',
        code: `// doubled clap hit
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ [cp cp] ~ ~").bank("RolandTR909")
  .gain(.6).room(.15)
let hats = s("hh*8").bank("RolandTR909")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Shuffle Beat',
        code: `// shuffle groove
let drums = s("bd [~ bd] sd [~ bd]").bank("RolandTR909").gain(.8)
let hats = s("[hh hh hh]*2").bank("RolandTR909").gain("[.3 .5 .4]*2")

$: arrange(
  [2, drums],
  [4, stack(drums, hats)])`,
      },
      {
        label: 'Ghost Snare',
        code: `// ghost note snare
let drums = s("bd ~ sd ~").gain(.8)
let snare = s("~ [sd:3 ~] ~ [~ sd:3]").gain(.25).room(.2)
let hats = s("[~ hh]*4").gain(.4)

$: arrange(
  [2, drums],
  [2, stack(drums, snare)],
  [4, stack(drums, snare, hats)])`,
      },
      {
        label: 'Half-Time Feel',
        code: `// half-time groove
let kick = s("bd ~ ~ ~ bd ~ ~ ~").gain(.85)
let snare = s("~ ~ ~ ~ ~ ~ sd ~").gain(.7)
let hats = s("hh*8").gain("[.25 .4]*4")

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, hats)])`,
      },
      {
        label: 'Breakcore Chop',
        code: `// breakcore stutter
let drums = s("[bd bd] [sd bd] [bd sd] [sd sd]").gain(.8)
let hats = s("hh*16").gain("[.2 .4 .3 .5]*4")
let openHat = s("oh(3,8)").gain(.35)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, openHat)])`,
      },
      {
        label: 'Jazz Brush',
        code: `// jazz brush feel
let kick = s("bd ~ [~ bd] ~").gain(.6)
let rim = s("~ rim ~ rim").gain(.3)
let hats = s("hh*8").gain("[.15 .25 .2 .3]*2")

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, hats)])`,
      },
      {
        label: 'Riddim Shell',
        code: `// dancehall riddim
let kick = s("bd ~ bd ~").bank("RolandTR808").gain(.85)
let clap = s("~ ~ cp ~").bank("RolandTR808").gain(.6)
let rim = s("rim*8").bank("RolandTR808").gain("[.2 .35]*4")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, rim)])`,
      },
      {
        label: 'Marching',
        code: `// marching drum pattern
let drums = s("bd sd bd sd").gain(.75)
let kick = s("bd ~ ~ ~, ~ ~ bd ~").gain(.5)
let rim = s("[rim rim]*4").gain(.3)

$: arrange(
  [2, drums],
  [2, stack(drums, kick)],
  [4, stack(drums, kick, rim)])`,
      },
      {
        label: 'Lo-Fi Drums',
        code: `// dusty lo-fi drums
let kick = s("[bd:3 ~] [~ bd:3] ~ ~").gain(.4).lpf(800)
let rim = s("~ rim ~ rim").gain(.15).lpf(2000)
let hats = s("[~ hh:2]*4").gain("[.1 .2]*4").lpf(3500)

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, hats)])`,
      },
      {
        label: 'Glitch Kick',
        code: `// glitchy kick pattern
let kick = s("bd").chop(16).speed("<1 2 .5 1.5>")
  .gain(.7)
let clap = s("~ cp ~ ~").gain(.5)

$: arrange(
  [2, kick],
  [4, stack(kick, clap)])`,
      },
      {
        label: 'Tribal Perc',
        code: `// tribal percussion
let kick = s("bd(3,8)").gain(.75)
let rim = s("rim(7,16)").gain(.35)
let hats = s("hh(5,8)").gain(.3)
let openHat = s("oh(2,8)").gain(.25).room(.3)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, openHat)])`,
      },
      {
        label: 'Jersey Club',
        code: `// jersey club bounce
let kick = s("bd bd [~ bd] bd bd [~ bd] bd [bd bd]")
  .bank("RolandTR808").gain(.85)
let clap = s("~ ~ cp ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.65)
let hats = s("hh*16").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]*4")
let openHat = s("oh(3,16)").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, openHat)])`,
      },
      {
        label: 'Soca Riddim',
        code: `// soca carnival riddim
let kick = s("bd ~ bd ~").bank("RolandTR808").gain(.85)
let clap = s("~ cp ~ cp").bank("RolandTR808").gain(.65)
let hats = s("[hh hh hh hh]*4").bank("RolandTR808")
  .gain("[.25 .5 .3 .55]*4")
let openHat = s("oh(2,8)").bank("RolandTR808").gain(.3)
let rim = s("rim(5,16)").bank("RolandTR808").gain(.25)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, rim)])`,
      },
      {
        label: 'Footwork 160',
        code: `// footwork 160bpm feel
let kick = s("bd bd [~ bd] bd bd [~ bd] bd bd")
  .gain(.8).fast(1.25)
let clap = s("~ ~ ~ cp ~ ~ cp ~").gain(.6)
let hats = s("hh*16").gain("[.15 .3 .2 .35]*4")
let openHat = s("oh(3,8)").gain(.25)
let rim = s("rim(5,16)").gain(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, rim)])`,
      },
      {
        label: 'Bossa Nova',
        code: `// bossa nova pattern
let kick = s("bd ~ [~ bd] ~ bd ~ [~ bd] ~")
  .gain(.65)
let rim = s("rim ~ rim ~ rim ~ rim rim")
  .gain(.3)
let hats = s("[hh hh]*4").gain("[.15 .25]*4")
let openHat = s("~ ~ ~ ~ ~ oh ~ ~").gain(.2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, openHat)])`,
      },
      {
        label: 'Jungle Amen',
        code: `// amen break style
let drums = s("[bd ~ bd ~] [~ sd ~ ~] [~ bd ~ ~] [~ sd bd sd]")
  .gain(.8)
let hats = s("hh*16").gain("[.2 .35 .25 .4]*4")
let openHat = s("oh(2,16)").gain(.25).room(.2)
let rim = s("rim(3,16,2)").gain(.2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, openHat)],
  [4, stack(drums, hats, openHat, rim)])`,
      },
      {
        label: 'Industrial',
        code: `// industrial mechanical beat
let kick = s("bd*4").gain(.9).shape(.2)
let snare = s("~ sd ~ sd").gain(.7).crush(8)
let hats = s("hh*16").gain("[.2 .4]*8").crush(6)
let openHat = s("oh(3,8)").gain(.3).room(.3)
let rim = s("rim*8").gain("[.15 .25]*4").lpf(2000)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, openHat)],
  [4, stack(kick, snare, hats, openHat, rim)])`,
      },
      {
        label: 'Grime',
        code: `// grime 140 pattern
let kick = s("bd ~ [bd ~] ~ bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
let clap = s("~ ~ ~ ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.7)
let hats = s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")
let rim = s("rim(3,8)").bank("RolandTR808").gain(.25)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, rim)])`,
      },
      {
        label: 'Garage 2-Step',
        code: `// UK garage 2-step groove
let kick = s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[hh hh hh ~]*2").bank("RolandTR909").gain(.45)
let openHat = s("oh ~ ~ ~").bank("RolandTR909").gain(.25)
let rim = s("rim(3,8,1)").bank("RolandTR909").gain(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, rim)])`,
      },
      {
        label: 'Baltimore Club',
        code: `// baltimore club pattern
let kick = s("bd bd [~ bd] bd bd [~ bd] bd bd")
  .bank("RolandTR808").gain(.85)
let clap = s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.65)
let hats = s("hh*16").bank("RolandTR808")
  .gain("[.2 .3]*8")
let clap2 = s("cp(3,8,2)").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, clap2)])`,
      },
      {
        label: 'Neo Funk',
        code: `// neo funk drum groove
let kick = s("bd ~ [bd ~] ~ bd ~ ~ ~")
  .bank("RolandTR909").gain(.8)
let snare = s("~ sd ~ ~, ~ ~ ~ [~ sd]")
  .bank("RolandTR909").gain(.65)
let hats = s("[hh hh oh ~]*2").bank("RolandTR909").gain(.45)
let rim = s("rim(5,16)").bank("RolandTR909").gain(.2)
let openHat = s("oh(2,8,3)").bank("RolandTR909").gain(.25)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, rim)],
  [4, stack(kick, snare, hats, rim, openHat)])`,
      },
      {
        label: 'Lo-Fi Swing',
        code: `// lo-fi swing beat
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.4).lpf(800)
let rim = s("~ rim ~ rim").gain(.15).lpf(2000)
let hats = s("[hh:2 ~ hh:2 ~]*2")
  .gain("[.08 .15 .1 .2]*2").lpf(3500)
let openHat = s("oh ~ ~ ~").gain(.1).lpf(2500)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, openHat)])`,
      },
      {
        label: 'Amapiano Log',
        code: `// amapiano log drum pattern
let kick = s("bd ~ [~ bd] ~ bd ~ ~ ~")
  .bank("RolandTR808").gain(.75)
let rim = s("rim*8").bank("RolandTR808")
  .gain("[.15 .3 .2 .35 .15 .3 .2 .4]")
let clap = s("~ ~ cp ~").bank("RolandTR808").gain(.5)
let hats = s("hh*16").bank("RolandTR808").gain("[.1 .2]*8")

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, clap)],
  [4, stack(kick, rim, clap, hats)])`,
      },
      {
        label: 'UK Drill',
        code: `// UK drill pattern
let kick = s("bd ~ [~ bd] ~").gain(.85)
let snare = s("~ ~ ~ sd").gain(.7)
let hats = s("hh*8").gain("[.25 .5 .3 .6 .25 .55 .3 .65]")
let openHat = s("oh(2,8,3)").gain(.25)
let rim = s("rim(3,16)").gain(.2)
let clap = s("~ ~ ~ [~ cp]").gain(.4)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, openHat)],
  [4, stack(kick, snare, hats, openHat, rim, clap)])`,
      },
      {
        label: 'Cumbia Digital',
        code: `// digital cumbia groove
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.75)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.55)
let hats = s("[hh hh]*4").gain("[.25 .4]*4")
let rim = s("rim ~ rim ~ rim ~ rim ~").gain(.2)
let openHat = s("oh ~ ~ ~ oh ~ ~ ~").gain(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, rim)],
  [4, stack(kick, clap, hats, rim, openHat)])`,
      },
      {
        label: 'Broken Beat',
        code: `// broken beat groove
let kick = s("bd ~ [~ bd] ~ [bd ~] ~ bd ~")
  .bank("RolandTR909").gain(.8)
let snare = s("~ ~ ~ sd ~ sd ~ ~")
  .bank("RolandTR909").gain(.65)
let hats = s("hh*16").bank("RolandTR909")
  .gain("[.2 .35]*8")
let openHat = s("oh(2,8,5)").bank("RolandTR909").gain(.25)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, openHat)])`,
      },
      {
        label: 'Electro Body',
        code: `// electro body music
let kick = s("bd*4").bank("RolandTR808").gain(.85)
let clap = s("~ cp ~ cp").bank("RolandTR808").gain(.6)
let hats = s("hh*16").bank("RolandTR808")
  .gain("[.15 .3]*8")
let openHat = s("oh(3,8)").bank("RolandTR808").gain(.25)
let rim = s("rim(5,16,2)").bank("RolandTR808").gain(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, rim)])`,
      },
      {
        label: 'Cross Rhythm',
        code: `// african cross-rhythm
let kick = s("bd(3,8)").gain(.8)
let rim = s("rim(5,8)").gain(.35)
let clap = s("cp(2,8,3)").gain(.45)
let hats = s("hh(7,16)").gain("[.2 .35]*8")
let openHat = s("oh(3,16,5)").gain(.2).room(.2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, clap, hats)],
  [4, stack(kick, rim, clap, hats, openHat)])`,
      },
      {
        label: 'Polymetric 5/4',
        code: `// polymetric 5 over 4
let kick = s("bd(5,16)").gain(.8)
let clap = s("cp(4,16,2)").gain(.55)
let hats = s("hh(7,16)").gain(.35)
let rim = s("rim(3,16,1)").gain(.25)
let openHat = s("oh(2,16,7)").gain(.2).room(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, rim)],
  [4, stack(kick, clap, hats, rim, openHat)])`,
      },
      {
        label: 'Drum Fill',
        code: `// drum fill sequence
let drums = s("bd sd bd sd bd [sd sd] [bd bd] [sd sd sd sd]")
  .bank("RolandTR909").gain(.75)
let hats = s("hh*16").bank("RolandTR909")
  .gain("[.2 .3 .25 .35]*4")
let openHat = s("oh ~ ~ ~ oh ~ oh oh")
  .bank("RolandTR909").gain(.3)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, openHat)])`,
      },
      {
        label: 'Layered Kit',
        code: `// layered multi-kit drums
let kick = s("bd*4").bank("RolandTR909").gain(.8)
let kick2 = s("bd*4").bank("RolandTR808").gain(.3)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let snare = s("~ sd ~ ~").bank("RolandTR808").gain(.25)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.4)
let hats2 = s("hh*16").bank("RolandTR808").gain("[.1 .2]*8")

$: arrange(
  [2, stack(kick, kick2)],
  [2, stack(kick, kick2, clap, snare)],
  [4, stack(kick, kick2, clap, snare, hats, hats2)])`,
      },
    ],
  },
  {
    category: 'Melody & Notes',
    icon: '🎹',
    examples: [
      {
        label: 'Piano Melody',
        code: `// flowing piano line
let piano = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.6).room(.3)

$: arrange([4, piano])`,
      },
      {
        label: 'Supersaw Arp',
        code: `// supersaw arpeggio
let synth = note("c3 e3 g3 b3 c4 b3 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(2500).room(.3)

$: arrange([4, synth])`,
      },
      {
        label: 'FM Bell',
        code: `// fm bell tones
let lead = note("<c5 e5 g5 b5>")
  .s("sine").gain(.4)
  .fmi(2).fmh(3)
  .room(.5).decay(.8)

$: arrange([4, lead])`,
      },
      {
        label: 'Pentatonic Pluck',
        code: `// pentatonic pluck riff
let lead = n("0 2 4 6 9 6 4 2")
  .scale("A3:minor pentatonic")
  .s("triangle").gain(.5)
  .decay(.2).lpf(3000)

$: arrange([4, lead])`,
      },
      {
        label: 'Piano Phase',
        code: `// piano phasing pattern
let piano = note("e4 g4 b4 d5 d5 g4 e4 d5 b4 g4 d5 d5")
  .s("piano").gain(.5).slow(2)

$: arrange([4, piano])`,
      },
      {
        label: 'Stacked Octaves',
        code: `// octave layering
let synth = note("<c3 e3 g3 b3>")
  .s("sawtooth").gain(.35)
  .add(note("<c4 e4 g4 b4>"))
  .lpf(2000).room(.3)

$: arrange([4, synth])`,
      },
      {
        label: 'Vibraphone Jazz',
        code: `// jazz vibraphone melody
let bells = note("g4 b4 d5 c5 a4 f4 g4 b4")
  .s("gm_vibraphone").velocity(.5)
  .room(.4).delay(.2)

$: arrange([4, bells])`,
      },
      {
        label: 'Music Box',
        code: `// delicate music box
let bells = note("c5 e5 g5 c6 g5 e5 c5 e5")
  .s("gm_music_box").velocity(.4)
  .room(.5).delay(.2).slow(2)

$: arrange([4, bells])`,
      },
      {
        label: 'Sine Lead',
        code: `// pure sine lead
let lead = note("c4 ~ e4 ~ g4 ~ b4 ~")
  .s("sine").gain(.5)
  .room(.3).delay(.15)

$: arrange([4, lead])`,
      },
      {
        label: 'Square Melody',
        code: `// retro square wave
let synth = note("a3 c4 e4 a4 g4 e4 c4 a3")
  .s("square").gain(.35)
  .lpf(1800).decay(.3)

$: arrange([4, synth])`,
      },
      {
        label: 'Flute Line',
        code: `// flute melody
let flute = note("d5 f5 a5 g5 f5 d5 c5 d5")
  .s("gm_flute").velocity(.5)
  .room(.4)

$: arrange([4, flute])`,
      },
      {
        label: 'Marimba Run',
        code: `// marimba scale run
let bells = n("0 1 2 3 4 5 6 7")
  .scale("D4:dorian")
  .s("gm_marimba").velocity(.5)
  .room(.3)

$: arrange([4, bells])`,
      },
      {
        label: 'Trill',
        code: `// rapid note trill
let piano = note("[c4 d4]*4")
  .s("piano").gain(.45)
  .room(.2)

$: arrange([4, piano])`,
      },
      {
        label: 'Descending Run',
        code: `// descending scale
let lead = n("7 6 5 4 3 2 1 0")
  .scale("A4:minor")
  .s("triangle").gain(.45)
  .lpf(2500)

$: arrange([4, lead])`,
      },
      {
        label: 'Chromatic Rise',
        code: `// chromatic ascent
let synth = note("c4 d4 d4 e4 e4 f4 g4 g4")
  .s("sawtooth").gain(.35)
  .lpf(2200).decay(.2)

$: arrange([4, synth])`,
      },
      {
        label: 'Harp Gliss',
        code: `// harp glissando
let harp = n("0 2 4 5 7 9 11 12")
  .scale("C4:major")
  .s("gm_harp").velocity(.45)
  .room(.5).slow(2)

$: arrange([4, harp])`,
      },
      {
        label: 'Random Notes',
        code: `// random note picker
let piano = n(irand(8).segment(8))
  .scale("A3:minor pentatonic")
  .s("piano").gain(.5)

$: arrange([4, piano])`,
      },
      {
        label: 'Delayed Lead',
        code: `// delay-soaked lead
let lead = note("c4 e4 g4 c5")
  .s("sine").gain(.45)
  .delay(.5).delayfeedback(.55)
  .room(.3)

$: arrange([4, lead])`,
      },
      {
        label: 'Xylophone',
        code: `// bright xylophone
let bells = note("e5 g5 a5 b5 a5 g5 e5 d5")
  .s("gm_xylophone").velocity(.5)
  .room(.3)

$: arrange([4, bells])`,
      },
      {
        label: 'Glide Saw',
        code: `// portamento sawtooth
let synth = note("c3 g3 e4 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35)
  .lpf(1500).glide(.1)

$: arrange([4, synth])`,
      },
      {
        label: 'Pizzicato',
        code: `// pizzicato strings
let strings = n("0 4 7 12 7 4 0 -5")
  .scale("A3:minor")
  .s("gm_pizzicato_strings").velocity(.5)
  .room(.3)

$: arrange([4, strings])`,
      },
      {
        label: 'Organ Lead',
        code: `// organ melody line
let organ = note("c4 d4 e4 f4 g4 f4 e4 d4")
  .s("gm_drawbar_organ").velocity(.5)
  .room(.3)

$: arrange([4, organ])`,
      },
      {
        label: 'Celesta',
        code: `// celesta sparkle
let bells = note("g5 a5 b5 d6 b5 a5 g5 g5")
  .s("gm_celesta").velocity(.4)
  .room(.5).delay(.2)

$: arrange([4, bells])`,
      },
      {
        label: 'Whistle',
        code: `// whistle melody
let whistle = note("c5 d5 e5 g5 e5 d5 c5 a4")
  .s("gm_whistle").velocity(.45)
  .room(.3)

$: arrange([4, whistle])`,
      },
      {
        label: 'Kalimba',
        code: `// kalimba thumb piano
let bells = n("0 2 4 7 9 7 4 2")
  .scale("C5:major pentatonic")
  .s("gm_kalimba").velocity(.5)
  .room(.4)

$: arrange([4, bells])`,
      },
      {
        label: 'Recorder',
        code: `// gentle recorder
let flute = note("f4 g4 a4 c5 a4 g4 f4 e4")
  .s("gm_recorder").velocity(.4)
  .room(.3)

$: arrange([4, flute])`,
      },
      {
        label: 'Synth Brass',
        code: `// synth brass lead
let brass = note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_synth_brass1").velocity(.5)
  .lpf(2500)

$: arrange([4, brass])`,
      },
      {
        label: 'Arp Up Down',
        code: `// arp up and down
let synth = n("0 2 4 7 9 12 9 7 4 2 0 -3")
  .scale("A2:minor pentatonic")
  .s("sawtooth").gain(.35)
  .lpf(2000).room(.3)

$: arrange([4, synth])`,
      },
      {
        label: 'Pan Flute',
        code: `// pan flute line
let flute = note("e4 g4 a4 b4 d5 b4 a4 g4")
  .s("gm_pan_flute").velocity(.45)
  .room(.4)

$: arrange([4, flute])`,
      },
      {
        label: 'Trumpet Line',
        code: `// trumpet melody
let brass = note("c4 e4 g4 c5 ~ g4 e4 c4")
  .s("gm_trumpet").velocity(.45)
  .room(.3)

$: arrange([4, brass])`,
      },
      {
        label: 'Oboe Nocturne',
        code: `// oboe nocturne melody
let woodwind = note("d4 f4 a4 g4 f4 e4 d4 c4 d4 f4 a4 c5 a4 g4 f4 d4")
  .s("gm_oboe").velocity(.45)
  .room(.5).delay(.2).slow(2)

$: arrange([4, woodwind])`,
      },
      {
        label: 'Clarinet Jazz',
        code: `// jazz clarinet run
let woodwind = note("c4 d4 e4 f4 g4 b4 c5 b4 g4 f4 e4 d4 c4 b3 g3 c4")
  .s("gm_clarinet").velocity(.45)
  .room(.4).slow(2)

$: arrange([4, woodwind])`,
      },
      {
        label: 'Banjo Bluegrass',
        code: `// bluegrass banjo roll
let guitar = note("c4 e4 g4 c5 e4 g4 c5 e5 c5 g4 e4 c4 g3 c4 e4 g4")
  .s("gm_banjo").velocity(.5)
  .room(.25).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Shakuhachi Zen',
        code: `// zen shakuhachi melody
let flute = note("d4 ~ f4 ~ a4 ~ g4 ~ f4 ~ d4 ~ c4 ~ d4 ~")
  .s("gm_shakuhachi").velocity(.4)
  .room(.6).delay(.3).delayfeedback(.4).slow(2)

$: arrange([4, flute])`,
      },
      {
        label: 'Sitar Raga',
        code: `// sitar raga phrase
let sitar = note("c4 d4 e4 f4 g4 a4 b4 c5 b4 a4 g4 f4 e4 d4 c4 d4")
  .s("gm_sitar").velocity(.45)
  .room(.4).slow(2)

$: arrange([4, sitar])`,
      },
      {
        label: 'Accordion Waltz',
        code: `// accordion waltz melody
let accordion = note("c4 e4 g4 e4 c4 g3 c4 e4 f4 a4 c5 a4 f4 c4 f4 a4")
  .s("gm_accordion").velocity(.4)
  .room(.3).slow(2)

$: arrange([4, accordion])`,
      },
      {
        label: 'Harmonica Blues',
        code: `// blues harmonica riff
let harmonica = note("c4 e4 f4 g4 g4 ~ b4 g4 f4 e4 c4 ~ b3 c4 e4 ~")
  .s("gm_harmonica").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, harmonica])`,
      },
      {
        label: 'Ocarina Dreamy',
        code: `// dreamy ocarina melody
let flute = note("e4 g4 a4 b4 d5 b4 a4 g4 e4 d4 e4 g4 a4 e4 d4 e4")
  .s("gm_ocarina").velocity(.4)
  .room(.5).delay(.25).delayfeedback(.35).slow(2)

$: arrange([4, flute])`,
      },
      {
        label: 'Steel Drum Island',
        code: `// island steel drum melody
let bells = note("c4 e4 g4 c5 a4 g4 e4 c4 d4 f4 a4 d5 c5 a4 f4 d4")
  .s("gm_steel_drum").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, bells])`,
      },
      {
        label: 'Glockenspiel Frost',
        code: `// frosty glockenspiel
let bells = note("c5 d5 e5 g5 a5 g5 e5 d5 c5 e5 g5 c6 g5 e5 d5 c5")
  .s("gm_glockenspiel").velocity(.4)
  .room(.5).delay(.2).slow(2)

$: arrange([4, bells])`,
      },
      {
        label: 'Dulcimer Dance',
        code: `// dulcimer folk dance
let bells = note("c4 d4 e4 g4 a4 g4 e4 d4 c4 e4 g4 a4 c5 a4 g4 e4")
  .s("gm_dulcimer").velocity(.45)
  .room(.35).slow(2)

$: arrange([4, bells])`,
      },
      {
        label: 'Piccolo Flight',
        code: `// piccolo flight melody
let flute = note("g5 a5 b5 d6 c6 b5 a5 g5 f5 g5 a5 c6 b5 a5 g5 f5")
  .s("gm_piccolo").velocity(.4)
  .room(.35).slow(2)

$: arrange([4, flute])`,
      },
      {
        label: 'Cello Sorrow',
        code: `// sorrowful cello line
let strings = note("c3 d3 e3 g3 f3 e3 d3 c3 b2 c3 d3 f3 e3 d3 c3 b2")
  .s("gm_cello").velocity(.45)
  .room(.5).slow(4)

$: arrange([4, strings])`,
      },
      {
        label: 'Violin Soaring',
        code: `// soaring violin melody
let strings = note("g4 a4 b4 d5 e5 d5 b4 a4 g4 b4 d5 g5 d5 b4 a4 g4")
  .s("gm_violin").velocity(.45)
  .room(.5).delay(.15).slow(2)

$: arrange([4, strings])`,
      },
      {
        label: 'Koto Garden',
        code: `// japanese koto garden
let koto = note("c4 d4 f4 g4 a4 ~ c5 a4 g4 f4 d4 c4 ~ d4 f4 ~")
  .s("gm_koto").velocity(.4)
  .room(.5).delay(.25).delayfeedback(.35).slow(2)

$: arrange([4, koto])`,
      },
      {
        label: 'Alto Sax Smooth',
        code: `// smooth alto saxophone
let sax = note("c4 d4 e4 g4 f4 e4 d4 c4 b3 c4 d4 f4 e4 d4 c4 b3")
  .s("gm_alto_sax").velocity(.45)
  .room(.4).slow(2)

$: arrange([4, sax])`,
      },
      {
        label: 'FM Glass',
        code: `// FM glass bell tones
let lead = note("c5 e5 g5 b5 c6 b5 g5 e5 d5 f5 a5 c6 a5 f5 d5 c5")
  .s("sine").gain(.4)
  .fmi(3).fmh(5)
  .room(.5).delay(.2).slow(2)

$: arrange([4, lead])`,
      },
      {
        label: 'Bagpipe March',
        code: `// bagpipe march melody
let bagpipe = note("c4 d4 e4 g4 a4 g4 e4 d4 c4 d4 e4 g4 c5 g4 e4 d4")
  .s("gm_bagpipe").velocity(.4)
  .room(.4).slow(2)

$: arrange([4, bagpipe])`,
      },
      {
        label: 'Dual Melody',
        code: `// dual interweaving melodies
let flute = note("c4 ~ e4 ~ g4 ~ b4 ~")
  .s("gm_flute").velocity(.4)
  .room(.4)
let woodwind = note("~ g3 ~ b3 ~ d4 ~ f4")
  .s("gm_clarinet").velocity(.35)
  .room(.35)

$: arrange(
  [2, flute],
  [4, stack(flute, woodwind)])`,
      },
      {
        label: 'Scale Explorer',
        code: `// whole tone scale explorer
let bells = n("0 1 2 3 4 5 4 3 2 1 0 1 2 3 4 5")
  .scale("C4:major")
  .s("gm_vibraphone").velocity(.45)
  .room(.4).delay(.15).slow(2)

$: arrange([4, bells])`,
      },
    ],
  },
  {
    category: 'Bass',
    icon: '🔊',
    examples: [
      {
        label: 'House Sub',
        code: `// deep house sub bass
let sub = note("<c2 c2 f2 g2>")
  .s("sine").gain(.6)
  .lpf(200).shape(.15)

$: arrange([4, sub])`,
      },
      {
        label: 'Acid 303',
        code: `// acid bassline
let bass = note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.55)
  .lpf(sine.range(400,3000))
  .lpq(12).decay(.15)

$: arrange([4, bass])`,
      },
      {
        label: 'Reese Bass',
        code: `// thick reese bass
let bass = note("<c1 c1 e1 f1>")
  .s("sawtooth").gain(.5)
  .lpf(500).shape(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'DnB Jump',
        code: `// jumping dnb bass
let bass = note("[c2 ~] [~ g2] [e2 ~] [~ c2]")
  .s("sawtooth").gain(.55)
  .lpf(800).shape(.2)

$: arrange([4, bass])`,
      },
      {
        label: 'Wobble',
        code: `// wobble bass
let bass = note("c2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .lpq(8)

$: arrange([4, bass])`,
      },
      {
        label: 'Funk Slap',
        code: `// funky slap bass
let bass = note("c2 ~ g2 ~ a2 ~ g2 e2")
  .s("square").gain(.5)
  .lpf(1200).decay(.12)

$: arrange([4, bass])`,
      },
      {
        label: 'Sub Pulse',
        code: `// pulsing sub
let sub = note("c1*4").s("sine")
  .gain("[.4 .6 .5 .7]")
  .lpf(120)

$: arrange([4, sub])`,
      },
      {
        label: 'Octave Jump',
        code: `// octave-jumping bass
let bass = note("c2 c3 c2 c3 e2 e3 g2 g3")
  .s("sawtooth").gain(.45)
  .lpf(1000).decay(.15)

$: arrange([4, bass])`,
      },
      {
        label: 'FM Bass',
        code: `// fm deep bass
let sub = note("<c2 f2 g2 e2>")
  .s("sine").gain(.5)
  .fmi(1).fmh(2)
  .lpf(300)

$: arrange([4, sub])`,
      },
      {
        label: 'Dub Bass',
        code: `// dub reggae bass
let sub = note("c2 ~ ~ c2 ~ ~ e2 ~")
  .s("sine").gain(.55)
  .lpf(300).shape(.2)
  .room(.3)

$: arrange([4, sub])`,
      },
      {
        label: 'Pluck Bass',
        code: `// plucked bass
let bass = note("c2 e2 g2 c3")
  .s("triangle").gain(.5)
  .decay(.1).lpf(1500)

$: arrange([4, bass])`,
      },
      {
        label: 'Distorted Sub',
        code: `// distorted sub bass
let sub = note("<c1 e1 f1 g1>")
  .s("sine").gain(.5)
  .shape(.5).lpf(250)

$: arrange([4, sub])`,
      },
      {
        label: 'Glide Bass',
        code: `// sliding bassline
let bass = note("c2 g2 e2 c2")
  .s("sawtooth").gain(.45)
  .glide(.15).lpf(900)

$: arrange([4, bass])`,
      },
      {
        label: 'Pulse Width',
        code: `// pulse width bass
let bass = note("<c2 f2 e2 g2>")
  .s("square").gain(.45)
  .pw(sine.range(.1,.9).slow(4))
  .lpf(800)

$: arrange([4, bass])`,
      },
      {
        label: 'Stab Bass',
        code: `// short stab bass
let bass = note("c2 ~ ~ c2 e2 ~ ~ ~")
  .s("sawtooth").gain(.5)
  .decay(.08).lpf(1200)

$: arrange([4, bass])`,
      },
      {
        label: 'Rolling Bass',
        code: `// rolling eighth bass
let sub = note("c2 c2 e2 e2 f2 f2 g2 g2")
  .s("sine").gain(.5)
  .lpf(400).shape(.15)

$: arrange([4, sub])`,
      },
      {
        label: 'Detuned Bass',
        code: `// detuned thick bass
let bass = note("<c2 f2 g2 e2>")
  .s("sawtooth").gain(.4)
  .detune(12).lpf(700)

$: arrange([4, bass])`,
      },
      {
        label: 'Synth Bass',
        code: `// synth bass riff
let bass = note("c2 ~ e2 c2 g1 ~ c2 ~")
  .s("square").gain(.45)
  .lpf(sine.range(500,1500))
  .decay(.15)

$: arrange([4, bass])`,
      },
      {
        label: 'Filtered Sub',
        code: `// filter sweep sub
let sub = note("c1*2").s("sine").gain(.55)
  .lpf(sine.range(80,300).slow(8))
  .shape(.2)

$: arrange([4, sub])`,
      },
      {
        label: 'Trap 808',
        code: `// long 808 bass
let sub = note("c1 ~ ~ ~ e1 ~ ~ ~")
  .s("sine").gain(.6)
  .decay(1).lpf(200)
  .shape(.25)

$: arrange([4, sub])`,
      },
      {
        label: 'Squelch Bass',
        code: `// squelchy acid bass
let bass = note("c2 c2 [c2 e2] c2")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,2500).fast(2))
  .lpq(15).decay(.12)

$: arrange([4, bass])`,
      },
      {
        label: 'Finger Bass',
        code: `// finger bass pluck
let bass = note("c2 ~ g2 ~ a2 ~ g2 e2")
  .s("gm_electric_bass_finger").velocity(.55)

$: arrange([4, bass])`,
      },
      {
        label: 'Fretless Bass',
        code: `// fretless smooth
let bass = note("c2 d2 e2 f2 g2 f2 e2 d2")
  .s("gm_fretless_bass").velocity(.5)
  .room(.2)

$: arrange([4, bass])`,
      },
      {
        label: 'Slap Pick',
        code: `// slap bass pick
let bass = note("c2 ~ c2 g2 ~ g2 b2 ~")
  .s("gm_slap_bass1").velocity(.55)

$: arrange([4, bass])`,
      },
      {
        label: 'Chorus Bass',
        code: `// chorus detuned bass
let bass = note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.4)
  .detune(15).lpf(600)
  .room(.2)

$: arrange([4, bass])`,
      },
      {
        label: 'Muted Bass',
        code: `// muted staccato
let bass = note("c2 c2 ~ c2 e2 e2 ~ e2")
  .s("triangle").gain(.5)
  .decay(.05).lpf(800)

$: arrange([4, bass])`,
      },
      {
        label: 'Portamento Bass',
        code: `// sliding bass
let sub = note("c2 e2 g2 c3 g2 e2")
  .s("sine").gain(.5)
  .glide(.2).lpf(400)

$: arrange([4, sub])`,
      },
      {
        label: 'Phat Sub',
        code: `// phat layered sub
let sub = note("<c1 e1 f1 g1>")
  .s("sine").gain(.55)
  .shape(.3).lpf(150)
let bass = note("<c2 e2 f2 g2>")
  .s("triangle").gain(.25)
  .lpf(500)

$: arrange(
  [2, sub],
  [4, stack(sub, bass)])`,
      },
      {
        label: 'Arpeggio Bass',
        code: `// arpeggiated bass
let bass = note("c2 g2 e2 g2 c2 b1 e2 b1")
  .s("sawtooth").gain(.45)
  .lpf(1200).decay(.1)

$: arrange([4, bass])`,
      },
      {
        label: 'Sine Kick Bass',
        code: `// kick-like sine bass
let sub = note("c1*4").s("sine")
  .gain(.6).decay(.3)
  .lpf(100).shape(.4)

$: arrange([4, sub])`,
      },
      {
        label: 'Funk Thumb',
        code: `// funk thumb bass groove
let bass = note("c2 ~ c2 g2 ~ g2 b2 c3 c2 ~ e2 c2 g1 ~ c2 ~")
  .s("gm_electric_bass_finger").velocity(.55)
  .room(.2).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Reggae Offbeat',
        code: `// reggae offbeat bass
let sub = note("~ c2 ~ c2 ~ e2 ~ c2 ~ c2 ~ g2 ~ f2 ~ c2")
  .s("sine").gain(.55)
  .lpf(300).shape(.2).slow(2)

$: arrange([4, sub])`,
      },
      {
        label: 'Prog Sequence',
        code: `// progressive bass sequence
let bass = note("c2 d2 e2 f2 g2 a2 b2 c3 b2 a2 g2 f2 e2 d2 c2 g1")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(400,1500).slow(8))
  .room(.2).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Disco Octave',
        code: `// disco octave bass
let bass = note("c2 c3 c2 c3 f2 f3 f2 f3 g2 g3 g2 g3 b2 b3 b2 b3")
  .s("square").gain(.45)
  .lpf(1200).decay(.1).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Electro Pulse',
        code: `// electro synth bass pulse
let bass = note("c2 c2 [c2 e2] c2 c2 [c2 g2] c2 c2")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,2000).fast(2))
  .lpq(8).shape(.15)

$: arrange([4, bass])`,
      },
      {
        label: 'Motown Walking',
        code: `// motown walking bass
let bass = note("c2 d2 e2 f2 g2 a2 b2 c3 g2 f2 e2 d2 c2 b1 a1 g1")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.2).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Neuro Riff',
        code: `// neuro bass riff
let bass = note("c1 c1 [e1 c1] g1 c1 c1 [f1 e1] c1")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,3000).fast(4))
  .lpq(12).shape(.3).crush(12)

$: arrange([4, bass])`,
      },
      {
        label: 'Latin Bass',
        code: `// latin bass montuno
let bass = note("c2 ~ e2 c2 g2 ~ c2 ~ f2 ~ a2 f2 c3 ~ f2 ~")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.2).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Deep Dub',
        code: `// deep dub bass drop
let sub = note("c2 ~ ~ c2 ~ ~ e2 ~ ~ ~ g2 ~ ~ ~ c2 ~")
  .s("sine").gain(.6)
  .lpf(250).shape(.25)
  .room(.4).delay(.4).delayfeedback(.5).slow(2)

$: arrange([4, sub])`,
      },
      {
        label: 'Synth Bass Arp',
        code: `// synth bass arpeggio
let bass = note("c2 g2 e2 g2 c3 g2 e2 c2 b1 f2 d2 f2 b2 f2 d2 b1")
  .s("square").gain(.45)
  .lpf(1500).decay(.1).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Picked Electric',
        code: `// electric bass picked
let bass = note("c2 c2 g2 g2 a2 a2 g2 e2")
  .s("gm_electric_bass_pick").velocity(.55)

$: arrange([4, bass])`,
      },
      {
        label: 'Fretless Glide',
        code: `// fretless gliding bass
let bass = note("c2 d2 e2 g2 a2 g2 e2 d2 c2 b1 a1 b1 c2 e2 g2 c3")
  .s("gm_fretless_bass").velocity(.5)
  .glide(.1).room(.25).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Dubstep Half',
        code: `// dubstep half-time bass
let bass = note("c1 ~ ~ ~ ~ ~ ~ ~ e1 ~ ~ ~ ~ ~ ~ ~")
  .s("sawtooth").gain(.55)
  .lpf(sine.range(100,2500).fast(4))
  .lpq(10).shape(.3).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Trance Pulse',
        code: `// trance bass pulse
let bass = note("c2 c2 c2 c2 c2 c2 c2 c2")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(300,1500).slow(8))
  .decay(.1).shape(.15)

$: arrange([4, bass])`,
      },
      {
        label: 'Hip-Hop 808 Slide',
        code: `// hip-hop 808 slide
let sub = note("c1 ~ ~ ~ e1 ~ c1 ~")
  .s("sine").gain(.6)
  .glide(.15).decay(.8)
  .lpf(180).shape(.3)

$: arrange([4, sub])`,
      },
      {
        label: 'Jazz Walking',
        code: `// jazz walking bass line
let bass = note("c2 e2 g2 a2 b2 a2 g2 e2 f2 a2 c3 d3 c3 a2 f2 c2")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.3).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Techno Acid Long',
        code: `// long acid techno bass
let bass = note("c2 [~ c2] e2 [c2 g1] f2 [~ f2] e2 [c2 b1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,4000).fast(2))
  .lpq(14).decay(.12)

$: arrange([4, bass])`,
      },
      {
        label: 'Choir Sub',
        code: `// choir sub layer bass
let sub = note("<c2 a1 b1 g1>")
  .s("sine").gain(.55)
  .lpf(200).shape(.2).slow(2)
let lead = note("<c3 a2 b2 g2>")
  .s("triangle").gain(.2)
  .lpf(600).slow(2)

$: arrange(
  [2, sub],
  [4, stack(sub, lead)])`,
      },
      {
        label: 'Multi-Octave Bass',
        code: `// multi-octave bass riff
let bass = note("c1 c2 c3 c2 e1 e2 e3 e2 f1 f2 f3 f2 g1 g2 g3 g2")
  .s("sawtooth").gain(.4)
  .lpf(1000).decay(.1).slow(2)

$: arrange([4, bass])`,
      },
    ],
  },
  {
    category: 'Chords & Pads',
    icon: '🎵',
    examples: [
      {
        label: 'Supersaw Pad',
        code: `// lush supersaw pad
let pad = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("supersaw").gain(.35)
  .lpf(2000).room(.4).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Piano Chords',
        code: `// smooth piano chords
let keys = note("<[c3,e3,g3,b3] [f3,a3,c4] [g3,b3,d4] [e3,g3,b3]>")
  .s("piano").gain(.5).room(.3).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Rhodes Chords',
        code: `// electric piano rhodes
let keys = note("<[e3,g3,b3] [a3,c4,e4] [b3,d4,f4] [g3,b3,d4]>")
  .s("gm_epiano1").velocity(.4)
  .room(.4).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Ambient Pad',
        code: `// ambient wash pad
let pad = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.7).roomsize(5)
  .lpf(1500).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Chord Stabs',
        code: `// rhythmic chord stabs
let pad = note("[c3,e3,g3] ~ [a2,c3,e3] ~")
  .s("supersaw").gain(.4)
  .lpf(2500).decay(.15)

$: arrange([4, pad])`,
      },
      {
        label: 'Jazz Voicings',
        code: `// jazz chord voicings
let keys = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("piano").gain(.45).room(.3).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Organ Chords',
        code: `// organ chord progression
let organ = note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("gm_organ1").velocity(.4)
  .room(.3).slow(2)

$: arrange([4, organ])`,
      },
      {
        label: 'Vowel Pad',
        code: `// vowel-like pad
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("sawtooth").gain(.3)
  .vowel("<a e i o>")
  .room(.5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'String Pad',
        code: `// orchestral strings
let strings = note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_strings1").velocity(.4)
  .room(.4).slow(4)

$: arrange([4, strings])`,
      },
      {
        label: 'Drone',
        code: `// deep drone pad
let bass = note("[c2,g2,c3]")
  .s("sawtooth").gain(.25)
  .lpf(400).room(.8).roomsize(6)

$: arrange([4, bass])`,
      },
      {
        label: 'Minor 7th Stack',
        code: `// stacked minor 7ths
let pad = note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a3,c4,e4,g4]>")
  .s("supersaw").gain(.3)
  .lpf(1800).room(.4).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Bright Saw Chords',
        code: `// bright sawtooth chords
let pad = note("<[c4,e4,g4] [f4,a4,c5] [g4,b4,d5] [c4,e4,g4]>")
  .s("sawtooth").gain(.35)
  .lpf(3000).room(.3)

$: arrange([4, pad])`,
      },
      {
        label: 'Power Chords',
        code: `// synth power chords
let bass = note("<[c2,g2,c3] [b1,f2,b2] [a1,e2,a2] [b1,f2,b2]>")
  .s("sawtooth").gain(.4)
  .lpf(1200).shape(.15).slow(2)

$: arrange([4, bass])`,
      },
      {
        label: 'Pluck Chords',
        code: `// plucked chord stabs
let pad = note("[c4,e4,g4] ~ ~ [a3,c4,e4]")
  .s("triangle").gain(.45)
  .decay(.2).room(.3)

$: arrange([4, pad])`,
      },
      {
        label: 'Wide Stereo Pad',
        code: `// stereo-wide pad
let pad = note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("supersaw").gain(.3)
  .pan(sine.range(.2,.8).slow(8))
  .room(.5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Glass Pad',
        code: `// glassy bell pad
let pad = note("<[c4,e4,g4,b4] [a3,c4,e4,g4]>")
  .s("sine").gain(.35)
  .fmi(1).fmh(5)
  .room(.6).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Detune Wash',
        code: `// detuned wash
let pad = note("<[c3,e3,g3]>")
  .s("sawtooth").gain(.3)
  .detune(15).lpf(1500)
  .room(.6).roomsize(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Choir Pad',
        code: `// choir aahs pad
let choir = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Maj7 Shimmer',
        code: `// shimmering major 7th
let pad = note("<[c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("supersaw").gain(.3)
  .lpf(2200).delay(.3)
  .delayfeedback(.4).room(.4).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Suspended Pad',
        code: `// suspended chord pad
let pad = note("<[c3,f3,g3] [a2,d3,e3]>")
  .s("sine").gain(.35)
  .room(.6).roomsize(4)
  .lpf(1200).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Wurlitzer',
        code: `// wurlitzer chords
let keys = note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("gm_epiano2").velocity(.4)
  .room(.3).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Nylon Guitar Chords',
        code: `// acoustic guitar chords
let guitar = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Harpsichord',
        code: `// harpsichord arpeggiated
let keys = note("<[c3,e3,g3] [d3,f3,a3] [e3,g3,b3] [c3,e3,g3]>")
  .s("gm_harpsichord").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Dim7 Tension',
        code: `// diminished 7th tension
let keys = note("<[c3,e3,g3,a3] [d3,f3,a3,b3]>")
  .s("piano").gain(.45)
  .room(.4).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Stack 5ths',
        code: `// stacked fifths
let pad = note("<[c3,g3,d4] [b2,f3,c4] [a2,e3,b3] [b2,f3,c4]>")
  .s("supersaw").gain(.3)
  .lpf(1800).room(.4).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Tremolo Pad',
        code: `// tremolo chord pad
let pad = note("[c3,e3,g3]*4")
  .s("sine").gain(sine.range(.15,.4).fast(6))
  .room(.5)

$: arrange([4, pad])`,
      },
      {
        label: 'Brass Stabs',
        code: `// brass chord stabs
let brass = note("[c3,e3,g3] ~ ~ [a2,c3,e3]")
  .s("gm_brass1").velocity(.5)
  .decay(.2)

$: arrange([4, brass])`,
      },
      {
        label: 'Reverse Pad',
        code: `// reverse swell pad
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).attack(.8)
  .room(.5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Bell Chords',
        code: `// bell-like chords
let pad = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("sine").gain(.35)
  .fmi(2).fmh(5)
  .room(.5).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Dark Minor',
        code: `// dark minor progression
let pad = note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("sawtooth").gain(.3)
  .lpf(1200).room(.4).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Gospel Chords',
        code: `// gospel piano chords
let keys = note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,g3,a3,c4] [g3,b3,d4,f4]>")
  .s("piano").gain(.5).room(.4).slow(2)
let bass = note("<c2 f2 d2 g2>")
  .s("gm_acoustic_bass").velocity(.4).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, bass)])`,
      },
      {
        label: 'Neo Soul Chords',
        code: `// neo soul extended chords
let keys = note("<[d3,g3,a3,c4,e4] [g3,b3,d4,f4,a4] [c3,e3,g3,b3,d4] [a2,d3,e3,g3,b3]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)
let sub = note("<d2 g2 c2 a1>")
  .s("sine").gain(.4).lpf(200).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Synth Choir Pad',
        code: `// synth choir pad wash
let synthChoir = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_synth_choir").velocity(.35)
  .room(.6).roomsize(5).slow(2)
let synthChoir2 = note("<[c4,e4,g4]>")
  .s("gm_synth_choir").velocity(.2)
  .room(.7).slow(4)

$: arrange(
  [2, synthChoir],
  [4, stack(synthChoir, synthChoir2)])`,
      },
      {
        label: 'Augmented Shimmer',
        code: `// augmented chord shimmer
let pad = note("<[c3,e3,a3] [a2,c3,e3] [e3,a3,c4] [c3,e3,a3]>")
  .s("supersaw").gain(.3)
  .lpf(2200).delay(.3).delayfeedback(.4)
  .room(.5).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Warm Pad Layers',
        code: `// layered warm pad
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("gm_warm_pad").velocity(.3)
  .room(.6).slow(4)
let pad2 = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("sine").gain(.2)
  .room(.5).slow(4)

$: arrange(
  [2, pad],
  [4, stack(pad, pad2)])`,
      },
      {
        label: 'R&B 9th Chords',
        code: `// R&B 9th chord voicings
let keys = note("<[e3,g3,b3,d4,f4] [a3,c4,e4,g4,b4] [b3,d4,f4,a4,c5] [g3,b3,d4,f4,a4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Cinematic Strings',
        code: `// cinematic string pad
let strings = note("<[c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d3,f3,b3] [g2,b2,d3,g3]>")
  .s("gm_strings1").velocity(.4)
  .room(.5).slow(4)
let strings2 = note("<[c4,e4,g4]>")
  .s("gm_strings2").velocity(.25)
  .room(.6).slow(4)

$: arrange(
  [2, strings],
  [4, stack(strings, strings2)])`,
      },
      {
        label: 'Lydian Float',
        code: `// lydian floating pad
let pad = note("<[c3,e3,g3,b3] [g2,b2,d3,g3]>")
  .s("supersaw").gain(.3)
  .lpf(2000).room(.5)
  .delay(.3).delayfeedback(.4).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Clavichord Pluck',
        code: `// plucked clavichord chords
let keys = note("<[c3,e3,g3] [f3,a3,c4] [d3,f3,a3] [g3,b3,d4]>")
  .s("gm_clavichord").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Bandcamp Synth',
        code: `// detuned synth pad
let pad = note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("sawtooth").gain(.3)
  .detune(20).lpf(1800)
  .room(.5).slow(2)
let pad2 = note("<[c4,e4,g4]>")
  .s("triangle").gain(.15)
  .room(.4).slow(4)

$: arrange(
  [2, pad],
  [4, stack(pad, pad2)])`,
      },
      {
        label: 'Church Organ',
        code: `// church organ chords
let organ = note("<[c3,e3,g3,c4] [f3,a3,c4,f4] [g3,b3,d4,g4] [c3,e3,g3,c4]>")
  .s("gm_church_organ").velocity(.4)
  .room(.7).roomsize(6).slow(2)

$: arrange([4, organ])`,
      },
      {
        label: 'Bright Poly',
        code: `// bright polysynth chords
let lead = note("<[c4,e4,g4,b4] [f4,a4,c5,e5] [g4,b4,d5,f5] [c4,e4,g4,b4]>")
  .s("gm_polysynth").velocity(.35)
  .room(.4).slow(2)

$: arrange([4, lead])`,
      },
      {
        label: 'Halo Ambient',
        code: `// halo ambient pad
let pad = note("<[c3,g3,c4] [a2,e3,a3] [b2,f3,b3] [g2,d3,g3]>")
  .s("gm_halo_pad").velocity(.3)
  .room(.7).roomsize(5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Crystal Shimmer',
        code: `// crystal shimmer chords
let pad = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_crystal").velocity(.35)
  .room(.6).delay(.3).delayfeedback(.45).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Accordion Folk',
        code: `// folk accordion chords
let accordion = note("<[c3,e3,g3] [f3,a3,c4] [g3,b3,d4] [c3,e3,g3]>")
  .s("gm_accordion").velocity(.4)
  .room(.3).slow(2)

$: arrange([4, accordion])`,
      },
      {
        label: 'Metallic Pad',
        code: `// metallic ringing pad
let pad = note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_metallic_pad").velocity(.3)
  .room(.6).roomsize(5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Sweep Pad',
        code: `// sweeping filter pad
let pad = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_sweep_pad").velocity(.3)
  .room(.5).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Bowed Glass',
        code: `// bowed glass pad
let pad = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("gm_bowed_glass").velocity(.3)
  .room(.7).roomsize(5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: '12-Bar Blues',
        code: `// 12-bar blues chords
let keys = note("<[c3,e3,g3,b3] [c3,e3,g3,b3] [c3,e3,g3,b3] [c3,e3,g3,b3] [f3,a3,c4,e4] [f3,a3,c4,e4] [c3,e3,g3,b3] [c3,e3,g3,b3] [g3,b3,d4,f4] [f3,a3,c4,e4] [c3,e3,g3,b3] [g3,b3,d4,f4]>")
  .s("piano").gain(.45).room(.3).slow(6)

$: arrange([4, keys])`,
      },
    ],
  },
  {
    category: 'Effects & FX',
    icon: '✨',
    examples: [
      {
        label: 'Filter Sweep',
        code: `// sweeping low-pass filter
let synth = note("c3*4").s("sawtooth").gain(.4)
  .lpf(sine.range(200,4000).slow(4))
  .lpq(6)

$: arrange([4, synth])`,
      },
      {
        label: 'Dub Delay',
        code: `// dub echo effect
let rim = s("rim:3 ~ ~ rim:3")
  .gain(.5).delay(.5)
  .delayfeedback(.65).room(.4)

$: arrange([4, rim])`,
      },
      {
        label: 'Reverb Cathedral',
        code: `// massive reverb space
let piano = note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("piano").gain(.45)
  .room(.9).roomsize(8)

$: arrange([4, piano])`,
      },
      {
        label: 'Bit Crush',
        code: `// lo-fi bit crushing
let synth = note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4)
  .crush(6).lpf(2000)

$: arrange([4, synth])`,
      },
      {
        label: 'Chop Glitch',
        code: `// glitchy chop FX
let synth = note("c3").s("sawtooth")
  .chop(16).gain(.4)
  .speed("<1 2 .5 1.5>")

$: arrange([4, synth])`,
      },
      {
        label: 'Stutter',
        code: `// stutter repeat effect
let piano = note("c4").s("piano")
  .chop(8).gain(.5)
  .room(.3)

$: arrange([4, piano])`,
      },
      {
        label: 'Vowel Morph',
        code: `// morphing vowel filter
let synth = note("c3*4").s("sawtooth")
  .gain(.4)
  .vowel("<a e i o u>")

$: arrange([4, synth])`,
      },
      {
        label: 'Phaser Effect',
        code: `// phaser on chord
let pad = note("[c3,e3,g3]*2")
  .s("sawtooth").gain(.35)
  .phaser(4).phaserdepth(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Pan Stereo',
        code: `// stereo auto-pan
let lead = note("c4 e4 g4 b4")
  .s("sine").gain(.45)
  .pan(sine.range(0,1))

$: arrange([4, lead])`,
      },
      {
        label: 'Speed Warp',
        code: `// speed modulation FX
let drums = s("bd sd hh cp")
  .bank("RolandTR808")
  .speed(perlin.range(.5,2))
  .gain(.6)

$: arrange([4, drums])`,
      },
      {
        label: 'Feedback Loop',
        code: `// heavy feedback delay
let lead = note("c4 ~ ~ ~").s("sine")
  .gain(.4).delay(.3)
  .delayfeedback(.85)
  .room(.3)

$: arrange([4, lead])`,
      },
      {
        label: 'Ring Mod',
        code: `// ring modulation tone
let lead = note("c3").s("sine").gain(.4)
  .ring(1).ringdf(500)

$: arrange([4, lead])`,
      },
      {
        label: 'Noise Wash',
        code: `// filtered noise sweep
let hats = s("hh*16").gain(.3)
  .lpf(sine.range(200,8000).slow(8))
  .room(.5)

$: arrange([4, hats])`,
      },
      {
        label: 'Retro Crush',
        code: `// retro crunch FX
let synth = note("c3 g3 e3 b3")
  .s("square").gain(.35)
  .crush(4).coarse(3)

$: arrange([4, synth])`,
      },
      {
        label: 'Delay Cascade',
        code: `// cascading delay echoes
let lead = note("c5 ~ ~ ~ e5 ~ ~ ~")
  .s("sine").gain(.4)
  .delay(.6).delayfeedback(.7)
  .delaytime(.33)

$: arrange([4, lead])`,
      },
      {
        label: 'Reverse Feel',
        code: `// reverse-like texture
let vox = s("chin:0").speed(-1)
  .gain(.5).room(.5)
  .delay(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Shimmer Verb',
        code: `// shimmering reverb
let lead = note("c5 e5 g5 c6").slow(2)
  .s("sine").gain(.35)
  .room(.9).roomsize(8)
  .delay(.3).delayfeedback(.4)

$: arrange([4, lead])`,
      },
      {
        label: 'Granular Chop',
        code: `// granular-style chop
let kick = s("bd").chop(32)
  .speed(perlin.range(.25,3))
  .gain(.5).room(.3)

$: arrange([4, kick])`,
      },
      {
        label: 'Dual Delay',
        code: `// ping-pong style delay
let lead = note("c4 ~ e4 ~").s("triangle")
  .gain(.4).delay(.5)
  .delayfeedback(.6)
  .pan("<0 1>")

$: arrange([4, lead])`,
      },
      {
        label: 'Distortion Wall',
        code: `// distorted wall of sound
let bass = note("[c2,g2,c3]").s("sawtooth")
  .gain(.35).shape(.6)
  .lpf(800).room(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'Tape Stop',
        code: `// tape stop effect
let synth = note("c3 e3 g3 c4")
  .s("sawtooth").gain(.4)
  .speed(perlin.range(.2,1)).lpf(2000)

$: arrange([4, synth])`,
      },
      {
        label: 'Flanger Sweep',
        code: `// flanger on drums
let drums = s("bd sd:2 [~ bd] sd")
  .bank("RolandTR808").gain(.7)
  .phaser(sine.range(1,8).slow(4))

$: arrange([4, drums])`,
      },
      {
        label: 'Grain Cloud',
        code: `// granular cloud texture
let vox = s("chin:0").chop(64)
  .speed(perlin.range(.1,4))
  .gain(.4).room(.6)

$: arrange([4, vox])`,
      },
      {
        label: 'Pitch Dive',
        code: `// pitch diving effect
let lead = note("c5 c5 c5 c5")
  .s("sine").gain(.4)
  .speed("<1 .5 .25 .12>")

$: arrange([4, lead])`,
      },
      {
        label: 'Lo-Fi Wash',
        code: `// lo-fi degraded wash
let pad = note("[c3,g3]*2").s("sawtooth")
  .gain(.35).crush(6).coarse(4)
  .room(.6).lpf(1500)

$: arrange([4, pad])`,
      },
      {
        label: 'Stutter Gate',
        code: `// gate stutter effect
let synth = note("c3").s("supersaw")
  .gain("[.5 0 .5 0 .5 0 .5 0]*2")
  .lpf(2000)

$: arrange([4, synth])`,
      },
      {
        label: 'Auto Wah',
        code: `// auto wah envelope
let synth = note("c3*4").s("sawtooth")
  .gain(.4)
  .lpf(sine.range(300,3000).fast(2))
  .lpq(10)

$: arrange([4, synth])`,
      },
      {
        label: 'Sidechain Feel',
        code: `// sidechain pump feel
let pad = note("[c3,e3,g3]").s("supersaw")
  .gain("[.1 .3 .45 .5]*2")
  .lpf(1800).room(.3)

$: arrange([4, pad])`,
      },
      {
        label: 'Freeze Hold',
        code: `// freeze sustain
let lead = note("c4").s("sine")
  .gain(.4).room(.9).roomsize(10)
  .delay(.8).delayfeedback(.85)

$: arrange([4, lead])`,
      },
      {
        label: 'Chaos Noise',
        code: `// chaotic noise FX
let hats = s("hh*16").speed(perlin.range(.1,5))
  .gain(.3).crush(4)
  .pan(perlin.range(0,1))

$: arrange([4, hats])`,
      },
      {
        label: 'Tape Warble',
        code: `// warbling tape effect
let piano = note("c3 e3 g3 c4").s("piano")
  .gain(.4).speed(sine.range(.95,1.05).slow(2))
  .lpf(2500).room(.3)
  .delay(.2).delayfeedback(.3)

$: arrange([4, piano])`,
      },
      {
        label: 'Chorus Wash',
        code: `// chorus effect wash
let pad = note("[c3,e3,g3]").s("sawtooth")
  .gain(.3).detune(sine.range(0,30).slow(4))
  .lpf(1500).room(.5)

$: arrange([4, pad])`,
      },
      {
        label: 'Glitch Slice',
        code: `// glitch slice machine
let drums = s("bd sd hh cp rim oh bd sd")
  .bank("RolandTR808").gain(.6)
  .chop(8).speed(perlin.range(.25,3))
  .pan(perlin.range(0,1))

$: arrange([4, drums])`,
      },
      {
        label: 'Radio Static',
        code: `// radio static effect
let hats = s("hh*32").gain("[.05 .15]*16")
  .crush(3).coarse(5)
  .lpf(sine.range(500,4000).slow(8))
  .pan(perlin.range(.3,.7))

$: arrange([4, hats])`,
      },
      {
        label: 'Crystal Echo',
        code: `// crystal echo reflections
let lead = note("c5 e5 g5 b5 c6 b5 g5 e5")
  .s("sine").gain(.35)
  .fmi(2).fmh(5)
  .delay(.4).delayfeedback(.6)
  .room(.7).slow(2)

$: arrange([4, lead])`,
      },
      {
        label: 'Drone Morph',
        code: `// morphing drone texture
let bass = note("[c2,g2]").s("sawtooth")
  .gain(.25).lpf(sine.range(200,1500).slow(16))
  .vowel("<a e i o>")
  .room(.8).roomsize(6)

$: arrange([4, bass])`,
      },
      {
        label: 'Wind Chimes',
        code: `// wind chime effect
let bells = n(irand(12).segment(16))
  .scale("C5:major pentatonic")
  .s("gm_glockenspiel").velocity(.3)
  .room(.6).delay(.3).delayfeedback(.5)

$: arrange([4, bells])`,
      },
      {
        label: 'Underwater',
        code: `// underwater effect
let lead = note("c3 e3 g3 b3").s("sine")
  .gain(.35).lpf(sine.range(200,800).slow(4))
  .room(.8).roomsize(8)
  .delay(.5).delayfeedback(.6)

$: arrange([4, lead])`,
      },
      {
        label: 'Sample Hold',
        code: `// sample and hold random
let synth = note("c3*8").s("square")
  .gain(.35).lpf(perlin.range(200,4000))
  .lpq(8).decay(.1)

$: arrange([4, synth])`,
      },
      {
        label: 'Laser Beam',
        code: `// laser beam effect
let lead = note("c6 c5 c4 c3 c2 c3 c4 c5")
  .s("sine").gain(.4)
  .fmi(8).fmh(1)
  .decay(.1).room(.3)

$: arrange([4, lead])`,
      },
      {
        label: 'Granular Scatter',
        code: `// granular scatter texture
let vox = s("chin:0").chop(64)
  .speed(perlin.range(.1,5))
  .gain(.35).pan(perlin.range(0,1))
  .room(.5).delay(.3).delayfeedback(.4)

$: arrange([4, vox])`,
      },
      {
        label: 'Metallic Ring',
        code: `// metallic ring modulation
let lead = note("c3 e3 g3 c4").s("sine")
  .gain(.4).ring(1).ringdf(800)
  .room(.4).delay(.25)

$: arrange([4, lead])`,
      },
      {
        label: 'Bit Cascade',
        code: `// bit depth cascade
let synth = note("c3 e3 g3 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35)
  .crush("<12 8 6 4 3 4 6 8>")
  .lpf(2000)

$: arrange([4, synth])`,
      },
      {
        label: 'Wobble Gate',
        code: `// wobble gate effect
let pad = note("[c3,e3,g3]").s("supersaw")
  .gain(sine.range(0,.5).fast(8))
  .lpf(sine.range(400,3000).fast(4))
  .room(.3)

$: arrange([4, pad])`,
      },
      {
        label: 'Reverse Swell',
        code: `// reverse swell buildup
let pad = note("<[c3,e3,g3]>").s("supersaw")
  .gain(.35).attack(1.5).decay(.1)
  .lpf(sine.range(500,3000).slow(4))
  .room(.5)

$: arrange([4, pad])`,
      },
      {
        label: 'Pitch Rise',
        code: `// rising pitch effect
let sub = note("c2 c2 c2 c2 c3 c3 c3 c3 c4 c4 c4 c4 c5 c5 c5 c5")
  .s("sine").gain(.4)
  .lpf(sine.range(300,4000).slow(4))
  .room(.3).slow(4)

$: arrange([4, sub])`,
      },
      {
        label: 'Texture Cloud',
        code: `// ambient texture cloud
let hats = s("hh*16").gain("[.02 .06 .04 .08]*4")
  .lpf(sine.range(500,5000).slow(16))
  .room(.8).roomsize(8)
  .pan(sine.range(.2,.8).slow(6))

$: arrange([4, hats])`,
      },
      {
        label: 'Vocoder Feel',
        code: `// vocoder-like effect
let synth = note("c3*4").s("sawtooth")
  .gain(.35).vowel("<a e i o u e a o>")
  .lpf(3000).room(.3)
  .pan(sine.range(.3,.7))

$: arrange([4, synth])`,
      },
      {
        label: 'Multi FX Chain',
        code: `// stacked FX chain
let synth = note("c3 e3 g3 b3").s("sawtooth")
  .gain(.35).crush(8)
  .lpf(sine.range(500,3000).slow(4))
  .delay(.4).delayfeedback(.5)
  .room(.5).pan(sine.range(.2,.8))

$: arrange([4, synth])`,
      },
    ],
  },
  {
    category: 'Full Compositions',
    icon: '🎼',
    examples: [
      {
        label: 'Deep House',
        code: `// deep house groove
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.5)
let bass = note("<c2 c2 a1 b1>")
  .s("sawtooth").gain(.5)
  .lpf(800).shape(.15)
let pad = note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.3).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, pad)])`,
      },
      {
        label: 'Dark Techno',
        code: `// dark techno drive
let kick = s("bd*4").gain(.9)
let clap = s("~ cp ~ ~").gain(.5).room(.3)
let hats = s("[~ hh]*4").gain(.4)
let openHat = s("~ ~ ~ oh").gain(.3)
let bass = note("c1*4").s("sawtooth")
  .gain(.45).lpf(400).shape(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, bass)])`,
      },
      {
        label: 'Boom Bap Beat',
        code: `// classic boom bap
let kick = s("bd ~ [~ bd] ~").bank("RolandTR808").gain(.85)
let snare = s("~ sd ~ sd").bank("RolandTR808").gain(.7)
let hats = s("[hh hh] [hh oh] [hh hh] [hh ~]").bank("RolandTR808").gain(.4)
let sub = note("<c2 f2 g2 b1>")
  .s("sine").gain(.5).lpf(200)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, sub)])`,
      },
      {
        label: 'Garage Shuffle',
        code: `// 2-step UK garage
let kick = s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[hh hh hh ~]*2").bank("RolandTR909").gain(.45)
let keys = note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, keys)])`,
      },
      {
        label: 'Synthwave',
        code: `// synthwave nostalgia
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.55)
let hats = s("[~ hh]*4").gain(.4)
let bass = note("<c2 f2 g2 a2>")
  .s("sawtooth").gain(.45)
  .lpf(600).shape(.2)
let pad = note("<[c4,e4,g4] [f4,a4,c5] [g4,b4,d5] [a4,c5,e5]>")
  .s("supersaw").gain(.3)
  .lpf(2000).room(.3).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, pad)])`,
      },
      {
        label: 'Trap',
        code: `// modern trap
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.9)
let clap = s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.7)
let hats = s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .5 .35 .7]")
let sub = note("<c1 ~ e1 ~>")
  .s("sine").gain(.6).decay(.8)
  .lpf(180).shape(.25)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, sub)])`,
      },
      {
        label: 'DnB',
        code: `// drum and bass
let kick = s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
let snare = s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
let hats = s("hh*8").gain("[.3 .5]*4")
let bass = note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.5)
  .lpf(800).shape(.2)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, bass)])`,
      },
      {
        label: 'Ambient Drift',
        code: `// ambient texture
let pad = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.8).roomsize(6)
  .lpf(1500).slow(4)
let lead = note("<c5 e5 g5 b5>")
  .s("sine").gain(.2)
  .delay(.5).delayfeedback(.6)
  .room(.7).slow(4)

$: arrange(
  [2, pad],
  [4, stack(pad, lead)])`,
      },
      {
        label: 'Trance Build',
        code: `// trance energy
let kick = s("bd*4").gain(.85)
let clap = s("~ cp ~ ~").gain(.55)
let hats = s("[~ hh]*4").gain(.45)
let openHat = s("~ ~ ~ oh").gain(.35)
let synth = note("c3 c3 e3 g3")
  .s("supersaw").gain(.4)
  .lpf(sine.range(800,3000).slow(8))

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, synth)])`,
      },
      {
        label: 'Phonk',
        code: `// dark phonk
let kick = s("bd ~ [bd bd] ~").gain(.85)
let clap = s("~ cp ~ cp").gain(.6).room(.2)
let hats = s("[~ hh]*4").gain(.45)
let sub = note("<c2 c2 b1 c2>")
  .s("sine").gain(.5)
  .lpf(200).shape(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, sub)])`,
      },
      {
        label: 'Drill',
        code: `// drill pattern
let kick = s("bd ~ [~ bd] ~").gain(.85)
let snare = s("~ ~ ~ sd").gain(.7)
let hats = s("hh*8").gain("[.25 .5 .3 .6 .25 .55 .3 .65]")
let sub = note("<c2 e2 f2 e2>")
  .s("sine").gain(.5)
  .lpf(200).decay(.6)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, sub)])`,
      },
      {
        label: 'Future Bass',
        code: `// future bass vibes
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.8)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
let hats = s("[~ hh]*4").gain(.4)
let pad = note("<[c4,e4,g4,b4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("supersaw").gain(.35)
  .lpf(2500).room(.3).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, pad)])`,
      },
      {
        label: 'Dubstep',
        code: `// dubstep half-time
let kick = s("bd ~ ~ ~ bd ~ ~ ~").gain(.9)
let clap = s("~ ~ ~ ~ ~ ~ cp ~").gain(.7)
let hats = s("[~ hh]*4").gain(.4)
let bass = note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .lpq(8).shape(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, bass)])`,
      },
      {
        label: 'Afrobeats',
        code: `// afrobeats groove
let kick = s("bd(3,8)").bank("RolandTR808").gain(.8)
let clap = s("cp(2,8)").bank("RolandTR808").gain(.5)
let rim = s("rim(5,8)").bank("RolandTR808").gain(.4)
let hats = s("hh(7,16)").bank("RolandTR808").gain("[.3 .5]*8")
let sub = note("<c2 f2 g2 f2>")
  .s("sine").gain(.5).lpf(200)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, rim, hats)],
  [4, stack(kick, clap, rim, hats, sub)])`,
      },
      {
        label: 'R&B Smooth',
        code: `// smooth R&B
let kick = s("[bd ~] [~ bd] [bd ~] [~ ~]").gain(.75)
let rim = s("~ rim ~ rim").gain(.3)
let hats = s("[~ hh]*4").gain(.35)
let keys = note("<[e3,g3,b3,d4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)
let sub = note("<e2 a2 b2 g2>")
  .s("sine").gain(.45).lpf(200)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, keys)],
  [4, stack(kick, rim, hats, keys, sub)])`,
      },
      {
        label: 'Lo-Fi Hip Hop',
        code: `// lo-fi hip hop beats
let kick = s("[bd:3 ~] [~ bd:3] ~ ~").gain(.4).lpf(800)
let rim = s("~ rim ~ rim").gain(.15).lpf(2000)
let hats = s("[~ hh:2]*4").gain("[.1 .2 .12 .25]").lpf(3500)
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("piano").gain(.5).room(.4).slow(2)
let sub = note("<c2 a1>")
  .s("sine").gain(.5).lpf(200).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, keys)],
  [4, stack(kick, rim, hats, keys, sub)])`,
      },
      {
        label: 'Electro Funk',
        code: `// electro funk groove
let kick = s("bd*4").gain(.85)
let clap = s("~ cp ~ ~").gain(.6)
let hats = s("[hh hh oh ~]*2").gain(.45)
let bass = note("c2 ~ c2 g2 ~ g2 b2 ~")
  .s("square").gain(.45)
  .lpf(1200).decay(.12)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, bass)])`,
      },
      {
        label: 'IDM Glitch',
        code: `// IDM complexity
let kick = s("bd(3,8)").gain(.75)
let snare = s("sd(5,8,1)").gain(.55)
let hats = s("hh(11,16)").gain(.35)
let lead = note("c3 e3 g3 b3 d4 b3 g3 e3")
  .s("triangle").gain(.4)
  .chop(4).lpf(2000)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, lead)])`,
      },
      {
        label: 'Reggaeton',
        code: `// reggaeton dembow
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.85)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
let hats = s("[hh hh]*4").gain("[.3 .5]*4")
let sub = note("<c2 f2 b1 e2>")
  .s("sine").gain(.5).lpf(200)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, sub)])`,
      },
      {
        label: 'Minimal Techno',
        code: `// minimal techno loop
let kick = s("bd*4").gain(.8)
let rim = s("~ rim ~ ~").gain(.3)
let hats = s("hh*16").gain("[.15 .3]*8")
let sub = note("c2*4").s("sine")
  .gain(.4).lpf(200).shape(.15)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, sub)])`,
      },
      {
        label: 'Acid Techno',
        code: `// acid techno
let kick = s("bd*4").gain(.9)
let clap = s("~ cp ~ ~").gain(.55)
let hats = s("[~ hh]*4").gain(.4)
let bass = note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(400,3000)).lpq(12)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, bass)])`,
      },
      {
        label: 'Chill Trap',
        code: `// chill trap
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.85)
let clap = s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.6)
let hats = s("hh*8").bank("RolandTR808").gain("[.2 .4]*4")
let keys = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("piano").gain(.4).room(.4).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, keys)])`,
      },
      {
        label: 'House Piano',
        code: `// piano house
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.5)
let keys = note("[c3,e3,g3] ~ [a2,c3,e3] ~")
  .s("piano").gain(.5).room(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, keys)])`,
      },
      {
        label: 'Jungle Break',
        code: `// jungle breakbeat
let kick = s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
let snare = s("[~ sd ~ ~] [~ ~ sd ~]").gain(.7)
let hats = s("hh*16").gain("[.2 .35]*8")
let bass = note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.5).lpf(600)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, bass)])`,
      },
      {
        label: 'Neo Soul',
        code: `// neo soul
let kick = s("[bd ~] [~ bd] [bd ~] ~").gain(.7)
let rim = s("~ rim ~ rim").gain(.3)
let hats = s("[~ hh]*4").gain(.35)
let keys = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("gm_epiano1").velocity(.35).room(.4).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats)],
  [4, stack(kick, rim, hats, keys)])`,
      },
      {
        label: 'UK Bass',
        code: `// UK bass music
let kick = s("bd ~ [~ bd] ~").gain(.85)
let clap = s("~ cp ~ ~").gain(.6)
let hats = s("[hh hh hh ~]*2").gain(.45)
let bass = note("[c2 ~] [~ e2] [c2 ~] [~ g1]")
  .s("sawtooth").gain(.55).lpf(800).shape(.2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, bass)])`,
      },
      {
        label: 'Downtempo',
        code: `// downtempo chill
let kick = s("[bd:3 ~] ~ [~ bd:3] ~").gain(.4).lpf(800)
let rim = s("~ ~ rim ~").gain(.15)
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.3).room(.5).slow(4)

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, keys)])`,
      },
      {
        label: 'Psytrance',
        code: `// psytrance drive
let kick = s("bd*4").gain(.9)
let hats = s("[~ hh]*4").gain(.4)
let bass = note("c2*8").s("sawtooth")
  .gain(.5).lpf(sine.range(300,2000).fast(4))
  .lpq(10)

$: arrange(
  [2, kick],
  [2, stack(kick, hats)],
  [4, stack(kick, hats, bass)])`,
      },
      {
        label: 'Footwork',
        code: `// footwork juke
let kick = s("bd bd [~ bd] bd bd [~ bd] bd [bd bd]").gain(.8)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
let hats = s("hh*16").gain("[.2 .35]*8")

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Shoegaze',
        code: `// shoegaze wash
let kick = s("bd ~ bd ~").gain(.6)
let snare = s("~ sd ~ sd").gain(.45)
let pad = note("[c3,e3,g3,b3]").s("supersaw")
  .gain(.3).room(.9).roomsize(8)
  .delay(.4).delayfeedback(.6)

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, pad)])`,
      },
      {
        label: 'Disco Funk',
        code: `// disco funk groove
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.6)
let hats = s("[hh hh oh ~]*2").bank("RolandTR909").gain(.45)
let bass = note("c2 c3 c2 c3 f2 f3 f2 f3")
  .s("gm_electric_bass_finger").velocity(.5)
let guitar = note("<[c3,e3,g3] [f3,a3,c4] [g3,b3,d4] [c3,e3,g3]>")
  .s("gm_clean_guitar").velocity(.35)
  .room(.3).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, guitar)])`,
      },
      {
        label: 'Chillwave',
        code: `// chillwave dreamy
let kick = s("[bd ~] [~ bd] [bd ~] ~").gain(.6)
let rim = s("~ rim ~ rim").gain(.2)
let hats = s("[~ hh]*4").gain(.3)
let pad = note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("supersaw").gain(.25)
  .lpf(1500).room(.6).delay(.3).delayfeedback(.4).slow(2)
let sub = note("<c2 a1>")
  .s("sine").gain(.4).lpf(200).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, pad)],
  [4, stack(kick, rim, hats, pad, sub)])`,
      },
      {
        label: 'Drum & Bass Full',
        code: `// full drum and bass track
let kick = s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
let snare = s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
let hats = s("hh*16").gain("[.2 .35]*8")
let bass = note("[c2 ~] [~ g2] [e2 ~] [~ c2]")
  .s("sawtooth").gain(.55)
  .lpf(800).shape(.2)
let pad = note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2)
  .lpf(1800).room(.3).slow(4)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, bass)],
  [4, stack(kick, snare, hats, bass, pad)])`,
      },
      {
        label: 'Latin Jazz',
        code: `// latin jazz groove
let kick = s("bd ~ [~ bd] ~ bd ~ [~ bd] ~").gain(.7)
let rim = s("rim ~ rim ~ rim ~ rim rim").gain(.3)
let hats = s("[hh hh]*4").gain("[.2 .3]*4")
let bells = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("gm_vibraphone").velocity(.35)
  .room(.4).slow(2)
let bass = note("c2 d2 e2 g2 a2 g2 e2 d2")
  .s("gm_acoustic_bass").velocity(.4)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, bells)],
  [4, stack(kick, rim, hats, bells, bass)])`,
      },
      {
        label: 'Reggae Dub',
        code: `// reggae dub track
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.75)
let clap = s("~ ~ cp ~ ~ ~ ~ ~").gain(.55)
  .delay(.4).delayfeedback(.55).room(.4)
let hats = s("[~ hh]*4").gain(.3)
let sub = note("c2 ~ ~ c2 ~ ~ e2 ~")
  .s("sine").gain(.55)
  .lpf(300).shape(.2).room(.3)
let guitar = note("<[e3,g3,b3] ~ ~ [a3,c4,e4] ~ ~ ~ ~>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, sub)],
  [4, stack(kick, clap, hats, sub, guitar)])`,
      },
      {
        label: 'Ambient Techno',
        code: `// ambient techno
let kick = s("bd*4").gain(.8)
let rim = s("~ rim ~ ~").gain(.25)
let hats = s("hh*16").gain("[.1 .2]*8")
let sub = note("c2*4").s("sine").gain(.4).lpf(200)
let pad = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.2)
  .room(.8).roomsize(6).slow(4)
let lead = note("<c5 e5 g5 b5>")
  .s("sine").gain(.15)
  .delay(.5).delayfeedback(.6).room(.6).slow(4)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, sub)],
  [4, stack(kick, rim, hats, sub, pad, lead)])`,
      },
      {
        label: 'Garage Revival',
        code: `// UK garage revival
let kick = s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.55)
let hats = s("[hh hh hh ~]*2").bank("RolandTR909").gain(.4)
let keys = note("<[e3,g3,b3,d4] [a3,c4,e4,g4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)
let sub = note("<e2 a2>")
  .s("sine").gain(.45).lpf(200).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, keys)],
  [4, stack(kick, clap, hats, keys, sub)])`,
      },
      {
        label: 'Grime Instrumental',
        code: `// grime instrumental
let kick = s("bd ~ [bd ~] ~ bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
let clap = s("~ ~ ~ ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.7)
let hats = s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")
let bass = note("<c2 c2 b1 c2>")
  .s("square").gain(.5).lpf(400)
let pad = note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2).lpf(1200)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, pad)])`,
      },
      {
        label: 'Progressive House',
        code: `// progressive house
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.55)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.4)
let openHat = s("~ ~ ~ oh").bank("RolandTR909").gain(.3)
let bass = note("<c2 c2 a1 b1>")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(400,1500).slow(16))
let pad = note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("supersaw").gain(.25)
  .lpf(sine.range(800,2500).slow(8)).room(.3).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, openHat)],
  [4, stack(kick, clap, hats, openHat, bass, pad)])`,
      },
      {
        label: 'Funk Rock',
        code: `// funk rock groove
let kick = s("bd ~ [bd ~] ~ bd ~ ~ ~")
  .bank("RolandTR909").gain(.8)
let snare = s("~ sd ~ ~ ~ sd ~ [~ sd]")
  .bank("RolandTR909").gain(.65)
let hats = s("[hh hh oh ~]*2").bank("RolandTR909").gain(.4)
let bass = note("e2 ~ e2 g2 ~ g2 a2 b2")
  .s("gm_electric_bass_finger").velocity(.5)
let guitar = note("e3 g3 a3 e3 g3 a3 b3 a3")
  .s("gm_overdriven_guitar").velocity(.4)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, bass)],
  [4, stack(kick, snare, hats, bass, guitar)])`,
      },
      {
        label: 'Cinematic Score',
        code: `// cinematic film score
let strings = note("<[c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d3,f3,b3] [g2,b2,d3,g3]>")
  .s("gm_strings1").velocity(.4)
  .room(.6).roomsize(5).slow(4)
let flute = note("<c5 e5 g5 b5>")
  .s("gm_flute").velocity(.3)
  .room(.5).slow(4)
let kick = s("~ ~ ~ ~ bd ~ ~ ~").gain(.5)
let bass = note("<c2 a1 b1 g1>")
  .s("gm_contrabass").velocity(.35).slow(4)

$: arrange(
  [2, stack(strings, flute)],
  [2, stack(strings, flute, kick)],
  [4, stack(strings, flute, kick, bass)])`,
      },
      {
        label: 'Gospel',
        code: `// gospel praise groove
let kick = s("[bd ~] [~ bd] [bd ~] [~ ~]").gain(.75)
let clap = s("~ cp ~ cp").gain(.55)
let hats = s("[hh hh]*4").gain(.35)
let keys = note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,g3,a3,c4] [g3,b3,d4,f4]>")
  .s("piano").gain(.5).room(.4).slow(2)
let bass = note("<c2 f2 d2 g2>")
  .s("gm_acoustic_bass").velocity(.4).slow(2)
let choir = note("<[c4,e4,g4]>")
  .s("gm_choir_aahs").velocity(.25).room(.5).slow(4)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, keys)],
  [4, stack(kick, clap, hats, keys, bass, choir)])`,
      },
      {
        label: 'Breakbeat Science',
        code: `// breakbeat science
let kick = s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
let snare = s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)
let hats = s("hh*16").gain("[.2 .35]*8")
let bass = note("c2 e2 g2 c3 g2 e2")
  .s("sawtooth").gain(.45).lpf(1000)
let pad = note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2)
  .lpf(1500).room(.3).slow(4)
let vox = s("chin:0 ~ chin:1 ~").gain(.3)
  .room(.3).speed(1.2)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats, bass)],
  [4, stack(kick, snare, hats, bass, pad, vox)])`,
      },
      {
        label: 'Bollywood Fusion',
        code: `// bollywood fusion beat
let kick = s("bd ~ [~ bd] ~").gain(.8)
let clap = s("~ ~ cp ~").gain(.6)
let hats = s("[hh hh]*4").gain("[.25 .4]*4")
let sitar = note("c4 d4 e4 f4 g4 a4 b4 c5")
  .s("gm_sitar").velocity(.4)
  .room(.3).slow(2)
let strings = note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("gm_strings1").velocity(.3)
  .room(.4).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, sitar)],
  [4, stack(kick, clap, hats, sitar, strings)])`,
      },
      {
        label: 'Salsa',
        code: `// salsa groove
let kick = s("bd ~ ~ bd ~ bd ~ ~")
  .bank("RolandTR808").gain(.75)
let rim = s("rim ~ rim ~ ~ rim ~ ~")
  .bank("RolandTR808").gain(.35)
let clap = s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.5)
let bass = note("c2 ~ e2 c2 g2 ~ c2 ~")
  .s("gm_acoustic_bass").velocity(.5)
let keys = note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("piano").gain(.4).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, clap, bass)],
  [4, stack(kick, rim, clap, bass, keys)])`,
      },
      {
        label: 'Vaporwave',
        code: `// vaporwave aesthetic
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.6).lpf(600)
let clap = s("~ ~ cp ~ ~ ~ cp ~").gain(.4).room(.5)
let keys = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).delayfeedback(.4).slow(2)
let sub = note("<c2 a1 f1 g1>")
  .s("sine").gain(.35).lpf(200).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, keys)],
  [4, stack(kick, clap, keys, sub)])`,
      },
      {
        label: 'Hyperpop',
        code: `// hyperpop energy
let kick = s("bd ~ bd ~ bd ~ bd bd").gain(.85)
let clap = s("~ cp ~ cp").gain(.65).crush(10)
let hats = s("hh*16").gain("[.25 .4]*8").crush(8)
let synth = note("c3 e3 g3 c4 e4 c4 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(3000).crush(10)
let sub = note("c1*4").s("sine").gain(.5)
  .lpf(150).shape(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, synth)],
  [4, stack(kick, clap, hats, synth, sub)])`,
      },
      {
        label: 'Bossa Nova Full',
        code: `// bossa nova full arrangement
let kick = s("bd ~ [~ bd] ~ bd ~ [~ bd] ~").gain(.6)
let rim = s("rim ~ rim ~ rim ~ rim rim").gain(.25)
let hats = s("[hh hh]*4").gain("[.12 .2]*4")
let bass = note("c2 d2 e2 g2 a2 g2 e2 d2")
  .s("gm_acoustic_bass").velocity(.4)
let guitar = note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_nylon_guitar").velocity(.35)
  .room(.3).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, bass)],
  [4, stack(kick, rim, hats, bass, guitar)])`,
      },
      {
        label: 'Synthpop',
        code: `// synthpop track
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.55)
let hats = s("[~ hh]*4").gain(.4)
let bass = note("<c2 f2 g2 c2>")
  .s("square").gain(.45).lpf(600)
let lead = note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_saw_lead").velocity(.35).room(.3)
let pad = note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("supersaw").gain(.25).lpf(1500).slow(2)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, lead, pad)])`,
      },
    ],
  },
  {
    category: 'Lofi & Chill',
    icon: '🌙',
    examples: [
      {
        label: 'Study Session',
        code: `// warm piano study vibes
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("piano").gain(.5).room(.4).slow(2)
let sub = note("<c2 a1 b1 g1>")
  .s("sine").gain(.5).lpf(200).shape(.15).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.4).lpf(800).shape(.2)
let rim = s("~ rim ~ rim").gain(.15).lpf(2000)
let hats = s("[~ hh:2]*4").gain("[.1 .2 .12 .25]").lpf(3500)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick, rim)],
  [4, stack(keys, sub, kick, rim, hats)])`,
      },
      {
        label: 'Rainy Rhodes',
        code: `// mellow rhodes in the rain
let keys = note("<[e3,g3,b3] [f3,a3,c4] [e3,g3,b3] [d3,f3,a3]>")
  .s("gm_epiano1").velocity(.3)
  .room(.5).delay(.3).slow(2)
let sub = note("<e2 f2 e2 d2>")
  .s("sine").gain(.45).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)
let hats = s("[~ hh:1]*4").gain("[.08 .15 .1 .2]").lpf(3000)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
      {
        label: 'Night Drive',
        code: `// dreamy late-night cruise
let keys = note("<[b3,d4,f4] [e3,g3,b3] [f3,a3,c4] [b3,d4,f4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)
let sub = note("<b1 e2 f2 b1>")
  .s("sine").gain(.45).lpf(200).shape(.15).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)
let hats = s("[~ hh:2]*4").gain("[.08 .18 .1 .2]").lpf(3000)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
      {
        label: 'Coffee Shop',
        code: `// cozy morning coffee
let keys = note("<[f3,a3,c4] [d3,f3,a3] [b2,d3,f3] [c3,e3,g3]>")
  .s("piano").gain(.5).room(.35).slow(2)
let sub = note("<f2 d2 b1 c2>")
  .s("sine").gain(.45).lpf(200).slow(2)
let kick = s("[bd:3 ~ ~] [~ ~ bd:3] ~ ~")
  .gain(.35).lpf(600)
let hats = s("[hh:1 ~ hh:1 ~]*2")
  .gain("[.08 .15 .1 .18]").lpf(3000)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
      {
        label: 'Sunset Gold',
        code: `// golden hour warmth
let keys = note("<[d3,f3,a3,c4] [e3,g3,b3] [d3,f3,a3] [a2,c3,e3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).delayfeedback(.35).slow(2)
let sub = note("<d2 e2 d2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ ~ [~ bd:3]")
  .gain(.3).lpf(500)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Autumn Leaves',
        code: `// falling leaves nostalgia
let keys = note("<[g3,b3,d4] [c3,e3,g3] [d3,f3,a3] [e3,g3,b3]>")
  .s("piano").gain(.5).room(.4)
  .delay(.25).delayfeedback(.3).slow(2)
let sub = note("<g1 c2 d2 e2>")
  .s("sine").gain(.45).lpf(200).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Moonlight',
        code: `// ethereal moonlit walk
let keys = note("<[a3,c4,e4] [f3,a3,c4] [g3,b3,d4] [e3,g3,b3]>")
  .s("piano").gain(.3).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)
let sub = note("<a1 f1 g1 e1>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Tape Loop',
        code: `// vintage tape rhodes
let keys = note("<[e3,a3,b3] [a2,d3,e3] [g2,a2,d3] [b2,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).delay(.3).slow(2)
let sub = note("<e2 a1 g2 b1>")
  .s("sine").gain(.45).lpf(200).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.35).lpf(600)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: '3AM Thoughts',
        code: `// dark bedroom confessions
let keys = note("<[d3,e3,a3] [a2,d3,e3] [b2,e3,g3] [a2,b2,e3]>")
  .s("piano").gain(.45).room(.5)
  .delay(.35).delayfeedback(.4).slow(2)
let sub = note("<d2 a1 b1 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Morning Light',
        code: `// bright morning warmth
let keys = note("<[d3,g3,a3] [g2,b2,d3] [a2,d3,e3] [d3,g3,a3]>")
  .s("piano").gain(.55).room(.35).slow(2)
let sub = note("<d2 g1 a1 d2>")
  .s("sine").gain(.45).lpf(200).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.35).lpf(600)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Vinyl Crackle',
        code: `// lo-fi vinyl warmth
let keys = note("<[e3,g3,b3] [a2,c3,e3]>")
  .s("piano").gain(.45).room(.4).slow(2)
let sub = note("<e2 a1>")
  .s("sine").gain(.45).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(600)
let hats = s("[~ hh:1]*4").gain("[.06 .12 .08 .15]").lpf(2500)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
      {
        label: 'Jazz Cafe',
        code: `// smoky jazz cafe
let keys = note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)
let sub = note("<d2 g2 c2 f2>")
  .s("sine").gain(.4).lpf(200).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Dreamy Piano',
        code: `// dreamy piano wash
let keys = note("<[f3,a3,c4,e4] [d3,f3,a3,c4]>")
  .s("piano").gain(.4).room(.6)
  .delay(.35).delayfeedback(.4).slow(4)
let sub = note("<f1 d1>")
  .s("sine").gain(.4).lpf(150).slow(4)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Bedroom Pop',
        code: `// bedroom pop feel
let keys = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("piano").gain(.5).room(.35).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
let rim = s("~ rim ~ rim").gain(.12)
let hats = s("[~ hh:1]*4").gain("[.08 .15 .1 .2]").lpf(3000)

$: arrange(
  [2, stack(keys, kick)],
  [2, stack(keys, kick, rim)],
  [4, stack(keys, kick, rim, hats)])`,
      },
      {
        label: 'Ambient Rain',
        code: `// ambient rain mood
let pad = note("<[c3,g3,c4]>")
  .s("sine").gain(.25)
  .room(.8).roomsize(6)
  .lpf(1200).slow(4)
let hats = s("hh*16").gain("[.04 .08]*8")
  .lpf(2000).room(.5)

$: arrange(
  [2, pad],
  [4, stack(pad, hats)])`,
      },
      {
        label: 'Warm Vibes',
        code: `// warm vibraphone lofi
let bells = n("<[~ 0] [4 ~] [~ 7] [4 ~]>")
  .scale("A3:minor pentatonic")
  .s("gm_vibraphone").velocity(.2)
  .room(.5).delay(.3).slow(2)
let sub = note("<c2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)

$: arrange(
  [2, bells],
  [2, stack(bells, sub)],
  [4, stack(bells, sub, kick)])`,
      },
      {
        label: 'Chill Pad',
        code: `// chillout pad texture
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.2)
  .lpf(1200).room(.6).slow(4)
let sub = note("<c2 a1>")
  .s("sine").gain(.4).lpf(160).slow(4)

$: arrange(
  [2, pad],
  [4, stack(pad, sub)])`,
      },
      {
        label: 'Old Cassette',
        code: `// old cassette tape feel
let keys = note("<[g3,b3,d4] [e3,g3,b3] [f3,a3,c4] [d3,f3,a3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
let sub = note("<g1 e2 f2 d2>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)
let rim = s("~ rim ~ ~").gain(.1).lpf(1500)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, rim)])`,
      },
      {
        label: 'Lazy Sunday',
        code: `// lazy sunday morning
let keys = note("<[b2,d3,f3,a3] [e3,g3,b3,d4] [f3,a3,c4,e4] [b2,d3,f3,a3]>")
  .s("piano").gain(.45).room(.4).slow(2)
let sub = note("<b1 e2 f2 b1>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.3).lpf(500)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Sleepy Haze',
        code: `// sleepy haze
let keys = note("<[a2,c3,e3,g3] [d3,f3,a3,c4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.4).delayfeedback(.45).slow(4)
let sub = note("<a1 d2>")
  .s("sine").gain(.35).lpf(150).slow(4)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Dusty Keys',
        code: `// dusty piano keys
let keys = note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3]>")
  .s("piano").gain(.45).room(.4).slow(2)
let sub = note("<a1 d2 g1 c2>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Midnight Walk',
        code: `// midnight walk vibes
let keys = note("<[f3,a3,c4] [d3,f3,a3] [e3,g3,b3] [c3,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).slow(2)
let sub = note("<f1 d2 e2 c2>")
  .s("sine").gain(.4).lpf(170).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Cloud Nine',
        code: `// floating cloud vibes
let keys = note("<[g3,b3,d4,g4] [e3,g3,b3,d4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.4).slow(4)

$: arrange([4, keys])`,
      },
      {
        label: 'Nostalgia',
        code: `// nostalgic warmth
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [f2,a2,c3,e3] [g2,b2,d3,f3]>")
  .s("piano").gain(.45).room(.4).slow(2)
let sub = note("<c2 a1 f1 g1>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Melted Ice',
        code: `// melted ice cream mood
let keys = note("<[b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).slow(4)

$: arrange([4, keys])`,
      },
      {
        label: 'Warm Blanket',
        code: `// warm blanket feel
let keys = note("<[d3,f3,a3] [b2,d3,f3] [c3,e3,g3] [a2,c3,e3]>")
  .s("piano").gain(.5).room(.4).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~").gain(.3).lpf(600)
let hats = s("[~ hh:1]*4").gain("[.06 .12]*4").lpf(2500)

$: arrange(
  [2, keys],
  [2, stack(keys, kick)],
  [4, stack(keys, kick, hats)])`,
      },
      {
        label: 'Faded Photo',
        code: `// faded photograph
let keys = note("<[e3,g3,b3] [c3,e3,g3] [a2,c3,e3] [b2,d3,g3]>")
  .s("piano").gain(.4).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Window Rain',
        code: `// rain on window
let keys = note("<[a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.7).roomsize(5).slow(4)
let hats = s("hh*16").gain("[.03 .06]*8").lpf(2000).room(.4)

$: arrange(
  [2, keys],
  [4, stack(keys, hats)])`,
      },
      {
        label: 'Old Film',
        code: `// old film score feel
let keys = note("<[f3,a3,c4] [d3,f3,a3] [g3,b3,d4] [e3,g3,b3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
let sub = note("<f1 d1 g1 e1>")
  .s("sine").gain(.4).lpf(160).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Soft Landing',
        code: `// soft landing pad
let keys = note("<[c3,e3,g3,b3]>")
  .s("piano").gain(.3).room(.6)
  .delay(.4).delayfeedback(.5).slow(4)
let sub = note("c2").s("sine").gain(.35).lpf(140).slow(4)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Sunset Groove',
        code: `// sunset groove session
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
let rim = s("~ rim ~ rim").gain(.12).lpf(1800)
let hats = s("[hh:2 ~ hh:2 ~]*2")
  .gain("[.06 .12 .08 .15]*2").lpf(3000)
let keys = note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.25).delayfeedback(.3).slow(2)
let sub = note("<a1 d2 e2 a1>")
  .s("sine").gain(.4).lpf(170).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, keys)],
  [4, stack(kick, rim, hats, keys, sub)])`,
      },
      {
        label: 'Library Study',
        code: `// quiet library study
let keys = note("<[e3,g3,b3,d4] [a2,c3,e3,g3] [d3,g3,a3,c4] [g2,b2,d3,f3]>")
  .s("piano").gain(.4).room(.35).slow(2)
let sub = note("<e2 a1 d2 g1>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(600)
let hats = s("[~ hh:1]*4").gain("[.05 .1 .07 .12]").lpf(2500)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
      {
        label: 'Rooftop View',
        code: `// rooftop city view
let keys = note("<[f3,a3,c4,e4] [b2,d3,g3,a3] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.45).room(.4)
  .delay(.2).delayfeedback(.3).slow(2)
let sub = note("<f2 b1 e2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.3).lpf(550)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Rainy Window',
        code: `// rainy window pane
let keys = note("<[d3,f3,a3,c4] [g2,b2,d3,f3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.6).delay(.3).delayfeedback(.35).slow(4)
let sub = note("<d2 g1>")
  .s("sine").gain(.35).lpf(160).slow(4)
let hats = s("hh*16").gain("[.02 .05]*8").lpf(1800).room(.4)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, hats)])`,
      },
      {
        label: 'Bookshop Calm',
        code: `// bookshop afternoon
let keys = note("<[g3,b3,d4,g4] [c3,e3,g3,b3] [d3,g3,a3,c4] [e3,g3,b3,d4]>")
  .s("piano").gain(.45).room(.35).slow(2)
let sub = note("<g1 c2 d2 e2>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)
let rim = s("~ ~ rim ~").gain(.08).lpf(1500)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, rim)])`,
      },
      {
        label: 'Garden Peace',
        code: `// peaceful garden walk
let keys = note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,f3,a3,c4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.25).slow(2)
let sub = note("<c2 f2 d2 g2>")
  .s("sine").gain(.35).lpf(170).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Late Night Radio',
        code: `// late night radio vibes
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.3).lpf(650)
let rim = s("~ rim ~ rim").gain(.1).lpf(1500)
let hats = s("[~ hh:1]*4").gain("[.05 .1]*4").lpf(2500)
let keys = note("<[b2,d3,f3,a3] [e3,g3,b3,d4] [f3,a3,c4,e4] [b2,d3,f3,a3]>")
  .s("piano").gain(.4).room(.4).slow(2)
let sub = note("<b1 e2 f2 b1>")
  .s("sine").gain(.4).lpf(170).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, hats, keys)],
  [4, stack(kick, rim, hats, keys, sub)])`,
      },
      {
        label: 'Misty Morning',
        code: `// misty morning haze
let keys = note("<[e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.4).slow(4)
let sub = note("<e2 a1>")
  .s("sine").gain(.35).lpf(150).slow(4)
let hats = s("hh*16").gain("[.02 .04]*8").lpf(1500).room(.3)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, hats)])`,
      },
      {
        label: 'Warm Cocoa',
        code: `// warm cocoa evening
let keys = note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [f2,a2,c3,e3] [e3,g3,b3,d4]>")
  .s("piano").gain(.45).room(.4).slow(2)
let sub = note("<a1 d2 f1 e2>")
  .s("sine").gain(.4).lpf(180).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~").gain(.3).lpf(550)
let rim = s("~ ~ rim ~").gain(.08).lpf(1200)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, rim)])`,
      },
      {
        label: 'Ocean Breeze',
        code: `// ocean breeze chill
let keys = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.3).delayfeedback(.35).slow(2)
let sub = note("<c2 a1 f1 g1>")
  .s("sine").gain(.35).lpf(160).slow(2)
let hats = s("hh*16").gain("[.03 .06]*8").lpf(2000).room(.3)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, hats)])`,
      },
      {
        label: 'Candlelight',
        code: `// candlelight dinner
let keys = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.4).room(.4)
  .delay(.2).delayfeedback(.3).slow(2)
let sub = note("<d2 g2 e2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Porch Swing',
        code: `// porch swing afternoon
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.3).lpf(600)
let rim = s("~ rim ~ rim").gain(.1).lpf(1500)
let keys = note("<[f3,a3,c4,e4] [b2,d3,f3,a3] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.25).slow(2)
let sub = note("<f1 b1 c2 f1>")
  .s("sine").gain(.35).lpf(160).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, keys)],
  [4, stack(kick, rim, keys, sub)])`,
      },
      {
        label: 'Twilight Zone',
        code: `// twilight zone vibes
let keys = note("<[g3,a3,d4,e4] [b2,d3,g3,a3]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.45).slow(4)
let sub = note("<g1 b1>")
  .s("sine").gain(.35).lpf(150).slow(4)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Vintage Soul',
        code: `// vintage soul warmth
let kick = s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
let rim = s("~ rim ~ rim").gain(.12).lpf(1800)
let keys = note("<[e3,g3,b3,d4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
let sub = note("<e2 a2 b2 g2>")
  .s("sine").gain(.4).lpf(180).slow(2)

$: arrange(
  [2, stack(kick, rim)],
  [2, stack(kick, rim, keys)],
  [4, stack(kick, rim, keys, sub)])`,
      },
      {
        label: 'Gentle River',
        code: `// gentle river flow
let keys = note("<[g3,b3,d4] [c3,e3,g3] [d3,g3,a3] [g3,b3,d4]>")
  .s("piano").gain(.4).room(.45)
  .delay(.3).delayfeedback(.35).slow(2)
let sub = note("<g1 c2 d2 g1>")
  .s("sine").gain(.35).lpf(170).slow(2)
let hats = s("hh*16").gain("[.02 .04]*8").lpf(1800)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, hats)])`,
      },
      {
        label: 'Train Ride',
        code: `// train ride scenery
let kick = s("[bd:3 ~] [bd:3 ~] [bd:3 ~] [bd:3 ~]")
  .gain(.25).lpf(500)
let keys = note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.4).room(.4).slow(2)
let sub = note("<a1 d2 e2 a1>")
  .s("sine").gain(.35).lpf(170).slow(2)

$: arrange(
  [2, kick],
  [2, stack(kick, keys)],
  [4, stack(kick, keys, sub)])`,
      },
      {
        label: 'Cozy Blanket',
        code: `// cozy blanket and tea
let keys = note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [a2,c3,e3,g3] [d3,f3,a3,c4]>")
  .s("piano").gain(.4).room(.45).slow(2)
let sub = note("<d2 g1 a1 d2>")
  .s("sine").gain(.35).lpf(160).slow(2)
let kick = s("[bd:3 ~] ~ [~ bd:3] ~").gain(.25).lpf(500)

$: arrange(
  [2, keys],
  [2, stack(keys, sub)],
  [4, stack(keys, sub, kick)])`,
      },
      {
        label: 'Stargazing',
        code: `// stargazing at midnight
let keys = note("<[a3,c4,e4,g4] [d3,f3,a3,c4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.6).roomsize(4)
  .delay(.35).delayfeedback(.4).slow(4)
let sub = note("<a1 d1>")
  .s("sine").gain(.3).lpf(140).slow(4)

$: arrange(
  [2, keys],
  [4, stack(keys, sub)])`,
      },
      {
        label: 'Paper Planes',
        code: `// paper planes floating
let keys = note("<[e3,g3,b3,d4] [c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,g3,a3]>")
  .s("piano").gain(.4).room(.4)
  .delay(.25).delayfeedback(.3).slow(2)
let sub = note("<e2 c2 a1 b1>")
  .s("sine").gain(.35).lpf(170).slow(2)
let kick = s("[bd:3 ~] [~ bd:3] ~ ~").gain(.25).lpf(500)
let hats = s("[~ hh:1]*4").gain("[.04 .08]*4").lpf(2200)

$: arrange(
  [2, stack(keys, sub)],
  [2, stack(keys, sub, kick)],
  [4, stack(keys, sub, kick, hats)])`,
      },
    ],
  },
  {
    category: 'Visuals',
    icon: '🌀',
    examples: [
      { label: '.scope()', code: `.scope()`, inline: true },
      { label: '.fscope()', code: `.fscope()`, inline: true },
      { label: '.pianoroll()', code: `.pianoroll()`, inline: true },
      { label: '.spiral()', code: `.spiral()`, inline: true },
      { label: '.scope({color})', code: `.scope({color:"#22d3ee",thickness:2})`, inline: true },
      { label: '.scope({smear})', code: `.scope({smear:.92})`, inline: true },
      { label: '.pianoroll({cycles})', code: `.pianoroll({cycles:8})`, inline: true },
      { label: '.pitchwheel()', code: `.pitchwheel()`, inline: true },
      { label: '.punchcard()', code: `.punchcard()`, inline: true },
      { label: '.wordfall()', code: `.wordfall()`, inline: true },
      {
        label: 'Scope + Piano',
        code: `// piano melody with oscilloscope
let piano = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.6).room(.3)
  .scope()

$: arrange([4, piano])`,
      },
      {
        label: 'Pianoroll + Chords',
        code: `// chord progression pianoroll
let keys = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("piano").gain(.5).room(.4).slow(2)
  .pianoroll({cycles:4})

$: arrange([4, keys])`,
      },
      {
        label: 'Spiral + Arp',
        code: `// arpeggio with spiral visual
let synth = note("c3 e3 g3 b3 c4 b3 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(2500).room(.3)
  .spiral()

$: arrange([4, synth])`,
      },
      {
        label: 'Pitchwheel + Melody',
        code: `// melody with pitch wheel visual
let bells = note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_vibraphone").velocity(.5)
  .room(.4)
  .pitchwheel()

$: arrange([4, bells])`,
      },
      {
        label: 'Punchcard + Drums',
        code: `// drum pattern punchcard visual
let drums = s("bd sd [~ bd] sd, [~ hh]*4, oh(2,8)")
  .bank("RolandTR808").gain(.75)
  .punchcard()

$: arrange([4, drums])`,
      },
      {
        label: 'Wordfall + Beats',
        code: `// beat pattern with wordfall labels
let drums = s("bd sd hh cp rim oh bd sd")
  .bank("RolandTR808").gain(.7)
  .wordfall()

$: arrange([4, drums])`,
      },
      {
        label: 'Scope Cyan Thick',
        code: `// thick cyan scope
let synth = note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4)
  .lpf(2000)
  .scope({color:"#22d3ee",thickness:3})

$: arrange([4, synth])`,
      },
      {
        label: 'Scope Pink',
        code: `// pink neon scope
let lead = note("c4 e4 g4 c5")
  .s("sine").gain(.5)
  .room(.3)
  .scope({color:"#ff1493",thickness:2})

$: arrange([4, lead])`,
      },
      {
        label: 'Scope Green Smear',
        code: `// smeared green scope trail
let synth = note("c3*4").s("sawtooth")
  .gain(.4).lpf(sine.range(200,4000).slow(4))
  .scope({color:"#4ade80",smear:.95,thickness:2})

$: arrange([4, synth])`,
      },
      {
        label: 'Fscope + Bass',
        code: `// bass frequency spectrum
let bass = note("c2 e2 g2 c3")
  .s("sawtooth").gain(.5)
  .lpf(1200).shape(.15)
  .fscope()

$: arrange([4, bass])`,
      },
      {
        label: 'Pianoroll Wide',
        code: `// wide pianoroll 8 cycles
let piano = n("0 2 4 7 9 12 9 7 4 2 0 -3")
  .scale("A2:minor pentatonic")
  .s("piano").gain(.5)
  .pianoroll({cycles:8})

$: arrange([4, piano])`,
      },
      {
        label: 'Multi Visual Scope',
        code: `// multi-track with scope
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.6)
let synth = note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4).lpf(1500)
  .scope({color:"#a855f7",thickness:2})

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, synth)])`,
      },
      {
        label: 'Spiral + Pad',
        code: `// pad with spiral visual
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.4).slow(2)
  .spiral()

$: arrange([4, pad])`,
      },
      {
        label: 'Pitchwheel + Flute',
        code: `// flute melody with pitchwheel
let flute = note("d5 f5 a5 g5 f5 d5 c5 d5")
  .s("gm_flute").velocity(.5).room(.4)
  .pitchwheel()

$: arrange([4, flute])`,
      },
      {
        label: 'Scope Orange',
        code: `// orange warm scope
let piano = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_epiano1").velocity(.4).room(.3)
  .scope({color:"#f97316",thickness:2,smear:.8})

$: arrange([4, piano])`,
      },
      {
        label: 'Punchcard + Full',
        code: `// full beat with punchcard
let drums = s("bd*4, ~ cp ~ ~, [~ hh]*4, oh(2,8)")
  .bank("RolandTR909").gain(.7)
let sub = note("c2*4").s("sine").gain(.4).lpf(200)
  .punchcard()

$: arrange(
  [2, drums],
  [4, stack(drums, sub)])`,
      },
      {
        label: 'Pianoroll + Scale',
        code: `// scale run pianoroll
let bells = n("0 1 2 3 4 5 6 7 6 5 4 3 2 1 0 -1")
  .scale("D4:dorian")
  .s("gm_marimba").velocity(.5).room(.3)
  .pianoroll({cycles:4})

$: arrange([4, bells])`,
      },
      {
        label: 'Scope Gold Smear',
        code: `// gold smeared scope
let synth = note("c3 g3 e4 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35).lpf(1500)
  .scope({color:"#eab308",thickness:2,smear:.9})

$: arrange([4, synth])`,
      },
      {
        label: 'Wordfall + Samples',
        code: `// sample names falling
let drums = s("bd cp hh oh rim sd bd cp")
  .bank("RolandTR808").gain(.65)
  .wordfall()

$: arrange([4, drums])`,
      },
      {
        label: 'Scope Red',
        code: `// red hot scope
let bass = note("c2*4").s("sawtooth")
  .gain(.5).lpf(sine.range(100,2000).fast(4))
  .shape(.2)
  .scope({color:"#ef4444",thickness:3})

$: arrange([4, bass])`,
      },
    ],
  },
  {
    category: 'Vocals',
    icon: '🎤',
    examples: [
      {
        label: 'Vocal Chop',
        code: `// rhythmic vocal chop
let vox = s("chin*4").gain(.6)
  .speed("<1 1.5 .75 2>")
  .room(.4).delay(.25)

$: arrange([4, vox])`,
      },
      {
        label: 'Breath Pad',
        code: `// breathy vocal texture
let breath = s("breath:0 breath:1 breath:0 breath:2")
  .gain(.4).room(.7).roomsize(5)
  .lpf(2000).slow(2)

$: arrange([4, breath])`,
      },
      {
        label: 'Vocal Stack',
        code: `// layered vocal hits
let vox = s("chin:0 chin:1 chin:2 chin:3")
  .gain(.5).room(.4)
  .speed(1).pan(sine.range(0,1))

$: arrange([4, vox])`,
      },
      {
        label: 'Stutter Vox',
        code: `// stuttered vocal
let vox = s("chin").chop(8)
  .speed(perlin.range(.8,1.5))
  .gain(.5).room(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Glitch Voice',
        code: `// glitched vocal FX
let vox = s("chin:1").chop(16)
  .speed("<1 -1 2 .5>")
  .gain(.5).crush(12)
  .room(.4).delay(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Choir Aahs',
        code: `// soft choir aahs
let choir = note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Voice Oohs',
        code: `// voice oohs pad
let oohs = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.5).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Synth Voice',
        code: `// synthetic voice lead
let synthVox = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_synth_voice").velocity(.45)
  .room(.3)

$: arrange([4, synthVox])`,
      },
      {
        label: 'Male Hum Low',
        code: `// low male humming tone
let choir = note("<c2 e2 f2 g2>")
  .s("gm_choir_aahs").velocity(.35)
  .lpf(600).room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Female Hum High',
        code: `// high female humming
let oohs = note("<c4 e4 f4 g4>")
  .s("gm_voice_oohs").velocity(.35)
  .lpf(3000).room(.5).slow(2)

$: arrange([4, oohs])`,
      },
      {
        label: 'Vocal Delay Echo',
        code: `// echoed vocal
let vox = s("chin:2").slow(2)
  .gain(.5).delay(.5)
  .delayfeedback(.6).room(.5)

$: arrange([4, vox])`,
      },
      {
        label: 'Reverb Cathedral',
        code: `// cathedral reverb vocal
let vox = s("chin:0 ~ chin:1 ~")
  .gain(.5).room(.9).roomsize(8)
  .slow(2)

$: arrange([4, vox])`,
      },
      {
        label: 'Delayed Choir',
        code: `// delayed choir wash
let choir = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.4).delayfeedback(.5)
  .room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Singing Melody',
        code: `// singing melodic line
let oohs = note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Harmony Stack',
        code: `// stacked vocal harmony
let choir = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4).slow(2)
let oohs = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.5).slow(2)

$: arrange(
  [2, choir],
  [4, stack(choir, oohs)])`,
      },
      {
        label: 'Numbers Talking',
        code: `// counting beat vocal
let numbers = s("numbers:0 numbers:1 numbers:2 numbers:3")
  .speed(1.2).gain(.5)
let drums = s("bd sd:2 bd sd:3")
  .bank("RolandTR808").gain(.7)

$: arrange(
  [2, numbers],
  [4, stack(numbers, drums)])`,
      },
      {
        label: 'East Chant',
        code: `// eastern chant
let east = s("east:0 east:2 east:3 east:6")
  .gain(.5).room(.3).slow(2)
let east2 = s("east:4 east:5").gain(.35)

$: arrange(
  [2, east],
  [4, stack(east, east2)])`,
      },
      {
        label: 'Chopped Choir',
        code: `// chopped choir stutter
let choir = note("[c3,e3,g3]")
  .s("gm_choir_aahs").velocity(.4)
  .chop(8).room(.3)

$: arrange([4, choir])`,
      },
      {
        label: 'Vocal Crush',
        code: `// crushed bitrate vocal
let vox = s("chin:0 chin:2 chin:1 chin:3")
  .gain(.5).crush(8)
  .room(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Reversed Vocal',
        code: `// reverse vocal texture
let vox = s("chin:0 chin:1")
  .speed(-1).gain(.5)
  .room(.5).delay(.3).slow(2)

$: arrange([4, vox])`,
      },
      {
        label: 'Female Singing',
        code: `// female singing line
let oohs = note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4).delay(.15)

$: arrange([4, oohs])`,
      },
      {
        label: 'Male Low Choir',
        code: `// deep male choir
let choir = note("<[c2,g2,c3] [a1,e2,a2]>")
  .s("gm_choir_aahs").velocity(.4)
  .lpf(800).room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Vocal Shimmer',
        code: `// shimmering vocal pad
let oohs = note("<[c4,e4,g4,b4]>")
  .s("gm_voice_oohs").velocity(.3)
  .delay(.4).delayfeedback(.55)
  .room(.7).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Whisper Texture',
        code: `// whisper-like texture
let breath = s("breath:0 ~ breath:1 ~")
  .gain(.35).room(.7).roomsize(5)
  .lpf(3000).slow(2)

$: arrange([4, breath])`,
      },
      {
        label: 'Vocal Drone',
        code: `// droning vocal pad
let choir = note("[c3,g3]")
  .s("gm_choir_aahs").velocity(.3)
  .room(.8).roomsize(6)
  .lpf(1000)

$: arrange([4, choir])`,
      },
      {
        label: 'Humming Duet',
        code: `// male and female hum duet
let choir = note("<c3 d3 e3 d3>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(700).room(.5).slow(2)
let oohs = note("<g4 a4 b4 a4>")
  .s("gm_voice_oohs").velocity(.25)
  .lpf(2500).room(.5).slow(2)

$: arrange(
  [2, choir],
  [4, stack(choir, oohs)])`,
      },
      {
        label: 'Delayed Oohs',
        code: `// delayed oohs wash
let oohs = note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.5).delayfeedback(.6)
  .room(.5)

$: arrange([4, oohs])`,
      },
      {
        label: 'Vocal Over Beat',
        code: `// vocal chop over beats
let drums = s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
let hats = s("[~ hh]*4").bank("RolandTR808").gain(.3)
let vox = s("chin:0 ~ chin:1 ~").gain(.5)
  .speed(1.2).room(.3)
  .delay(.25).delayfeedback(.4)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, vox)])`,
      },
      {
        label: 'Choir Swell',
        code: `// swelling choir
let choir = note("<[c3,e3,g3,b3]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.15,.5).slow(4))
  .room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Pitch Shift Vox',
        code: `// pitch-shifted vocal
let vox = s("chin:0 chin:1 chin:2 chin:0")
  .speed("<.5 1 1.5 2>")
  .gain(.5).room(.4)
  .delay(.2)

$: arrange([4, vox])`,
      },
      {
        label: 'R&B Soul Vocal',
        code: `// R&B soul vocal — "Midnight Glow"
// I feel the glow beneath the moonlit sky
// Your love surrounds me and I don't know why
// Every whisper pulls me closer still
// Dancing slowly on the windowsill
// Hold me tight until the morning light
let oohs = note("c4 d4 e4 g4 f4 e4 d4 c4").s("gm_voice_oohs")
  .velocity(sine.range(.3,.7).slow(8)).room(.5).delay(.15)
let piano = note("c3 e3 g3 b3").s("gm_epiano2").velocity(.3).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)

$: arrange(
  [2, oohs],
  [2, stack(oohs, piano)],
  [4, stack(oohs, piano, drums)])`,
      },
      {
        label: 'Jazz Scat Vocal',
        code: `// jazz scat vocal — "Blue Corner"
// Shoo-bee-doo-bah in the smoky hall
// Fingers snappin' echoes off the wall
// Walkin' bass line groovin' down below
// Trumpet cryin' soft and sweet and slow
// Midnight jazz that only dreamers know
let choir = note("g4 a4 b4 d5 c5 a4 g4 f4").s("gm_choir_aahs")
  .velocity("<.5 .6 .7 .5>").delay(.2).room(.6)
let bass = note("g2 a2 b2 c3 d3 c3 b2 a2").s("gm_acoustic_bass").velocity(.5)
let hats = s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, choir],
  [2, stack(choir, bass)],
  [4, stack(choir, bass, hats)])`,
      },
      {
        label: 'Gospel Choir',
        code: `// gospel choir — "Rise Up"
// Rise up children lift your voice on high
// Through the storm we'll reach the open sky
// Every burden laid upon the ground
// Grace and mercy all around resound
// Sing it louder let the joy be found
let choir = note("[c4,e4,g4] [d4,f4,a4] [e4,g4,b4] [c4,e4,g4]")
  .s("gm_choir_aahs").velocity(.7).room(.7).slow(2)
let organ = note("[c3,g3] [d3,a3] [e3,b3] [c3,g3]")
  .s("gm_church_organ").velocity(.4).slow(2)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, choir],
  [2, stack(choir, organ)],
  [4, stack(choir, organ, drums)])`,
      },
      {
        label: 'Hip-Hop Hook',
        code: `// hip-hop hook vocal — "City Lights"
// City lights reflectin' off the rain
// Chasin' dreams and runnin' through the pain
// Every block I walk I feel the beat
// Concrete jungle underneath my feet
// Mic in hand I own this midnight street
let synthVox = note("c4 c4 e4 f4 e4 c4 ~ c4").s("gm_synth_voice")
  .velocity(.6).delay(.1).room(.3)
let bass = note("c2 ~ c2 ~ e2 ~ f2 ~").s("gm_synth_bass_1").velocity(.7)
let drums = s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.6)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(synthVox, bass)],
  [2, stack(synthVox, bass, drums)],
  [4, stack(synthVox, bass, drums, hats)])`,
      },
      {
        label: 'Country Ballad Vox',
        code: `// country ballad vocal — "Dusty Road"
// Down the dusty road where the willows sway
// I recall your smile at the end of day
// Porch light glowin' like a guiding star
// Strummin' six string underneath the bar
// Miles between us but you're never far
let oohs = note("e4 g4 g4 a4 g4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(sine.range(.3,.6).slow(8)).room(.5)
let guitar = note("e3 a3 b3 e3 a3 b3 e3 a3").s("gm_steel_guitar").velocity(.35)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, guitar)],
  [4, stack(oohs, guitar, drums)])`,
      },
      {
        label: 'Reggae Chant',
        code: `// reggae vocal chant — "One Love Flow"
// One love flowin' through the island breeze
// Roots and culture swaying through the trees
// Every riddim makes the people free
// From the mountain down into the sea
// Unity is all we need to be
let choir = note("g3 b3 c4 d4 c4 b3 g3 ~").s("gm_choir_aahs")
  .velocity(.5).room(.6).delay(.25)
let bass = note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.6)
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
let rim = s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, drums)],
  [4, stack(choir, bass, drums, rim)])`,
      },
      {
        label: 'Blues Moan Vocal',
        code: `// blues moan vocal — "Lonesome Trail"
// Walkin' down this lonesome trail alone
// Every step reminds me you are gone
// Guitar cryin' what my lips can't say
// Storm clouds rollin' in to steal the day
// Got the blues and they are here to stay
let oohs = note("e3 g3 a3 b3 a3 g3 e3 ~").s("gm_voice_oohs")
  .velocity(sine.range(.4,.7).slow(6)).room(.5).slow(2)
let guitar = note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, guitar)],
  [4, stack(oohs, guitar, drums)])`,
      },
      {
        label: 'Pop Vocal Hook',
        code: `// pop vocal hook — "Neon Hearts"
// Neon hearts are flashing in the dark
// Every beat ignites another spark
// Dancing under ultraviolet glow
// Spinning round and never letting go
// Turn the music up and steal the show
let oohs = note("c5 b4 a4 g4 a4 b4 c5 ~").s("gm_voice_oohs")
  .velocity(.6).room(.4).delay(.12)
let keys = note("[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]")
  .s("gm_bright_piano").velocity(.35).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.25)

$: arrange(
  [2, stack(oohs, keys)],
  [2, stack(oohs, keys, drums)],
  [4, stack(oohs, keys, drums, hats)])`,
      },
      {
        label: 'Afrobeat Vocal',
        code: `// afrobeat vocal — "Sun Dancer"
// Sun dancer movin' to the ancient drum
// Feel the rhythm till the morning come
// Dust is risin' from the beaten ground
// Fire burnin' with a sacred sound
// Every step a blessing to be found
let choir = note("d4 f4 g4 a4 g4 f4 d4 f4").s("gm_choir_aahs")
  .velocity(.55).room(.4).delay(.18)
let bass = note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_synth_bass_1").velocity(.6)
let drums = s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, drums)],
  [4, stack(choir, bass, drums, hats)])`,
      },
      {
        label: 'Latin Vocal Salsa',
        code: `// latin vocal — "Fuego Nights"
// Fuego burning in the summer night
// Hips are swaying left and then the right
// Conga drums are calling from the street
// Every rhythm makes this life complete
// Dance until the sun and moonlight meet
let oohs = note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_voice_oohs")
  .velocity(.5).room(.35).delay(.1)
let bass = note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.55)
let drums = s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, rim)])`,
      },
      {
        label: 'Folk Harmony Vox',
        code: `// folk harmony vocal — "River Song"
// By the river where the cattails grow
// Sing a melody the waters know
// Harmonies as old as ancient stone
// Voices carry seeds the wind has sown
// Every verse a path that leads us home
let choir = note("g4 a4 b4 d5 b4 a4 g4 ~").s("gm_choir_aahs")
  .velocity(.45).room(.5)
let oohs = note("d4 e4 g4 a4 g4 e4 d4 ~").s("gm_voice_oohs")
  .velocity(.35).room(.5)
let guitar = note("g3 d3 g3 d3 g3 d3 g3 d3").s("gm_nylon_guitar").velocity(.3)

$: arrange(
  [2, choir],
  [2, stack(choir, oohs)],
  [4, stack(choir, oohs, guitar)])`,
      },
      {
        label: 'Electronic Vox Pad',
        code: `// electronic vocal pad — "Digital Dreams"
// Floating through a digital terrain
// Synthesized emotions fill my brain
// Pixel stars are scattered all around
// Binary code becomes a human sound
// Lost between the silence and the rain
let synthChoir = note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [g3,b3,d4]>")
  .s("gm_synth_choir").velocity(.5).room(.6).slow(4)
let synthVox = note("c5 e5 g5 ~ e5 c5 ~ g4").s("gm_synth_voice")
  .velocity(.3).delay(.3)
let drums = s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.35)

$: arrange(
  [2, synthChoir],
  [2, stack(synthChoir, synthVox)],
  [4, stack(synthChoir, synthVox, drums)])`,
      },
      {
        label: 'Indie Vocal Layer',
        code: `// indie vocal layers — "Paper Moon"
// Cut a paper moon and hang it high
// Watch it drift across a painted sky
// Whispered secrets only stars can hear
// Melodies that make the clouds appear
// Sing until the dawn is finally near
let oohs = note("e4 g4 a4 b4 a4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.5).room(.45).delay(.15)
let choir = note("e4 ~ a4 ~ b4 ~ g4 ~").s("gm_choir_aahs")
  .velocity(.3).room(.45).delay(.2)
let guitar = note("e2 b2 e2 a2 g2 e2 b2 e2").s("gm_clean_guitar").velocity(.35)
let drums = s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.4)

$: arrange(
  [2, stack(oohs, choir)],
  [2, stack(oohs, choir, guitar)],
  [4, stack(oohs, choir, guitar, drums)])`,
      },
      {
        label: 'Techno Vocal Chop',
        code: `// techno vocal chop — "System Override"
// System override breaking through the wall
// Bass is dropping deeper hear it call
// Strobe lights flashing in a concrete hall
// Every frequency controls us all
// Rise and fall and rise and never stall
let vox = s("chin:0 ~ chin:2 ~").speed("<1 1.5 .75 2>")
  .gain(.5).room(.2).delay(.1)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.65)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.4)
let bass = note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth").lpf(200).gain(.5)

$: arrange(
  [2, stack(vox, kick)],
  [2, stack(vox, kick, hats)],
  [4, stack(vox, kick, hats, bass)])`,
      },
      {
        label: 'Lullaby Vocal',
        code: `// lullaby vocal — "Starlit Cradle"
// Close your eyes the stars are shining bright
// Dream of meadows bathed in silver light
// Gentle winds will carry you to sleep
// Counting fireflies and woolen sheep
// Safe and warm the night will softly keep
let oohs = note("c5 b4 a4 g4 a4 g4 f4 e4").s("gm_voice_oohs")
  .velocity(sine.range(.2,.45).slow(8)).room(.6).slow(2)
let bells = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_music_box").velocity(.25).slow(4)

$: arrange(
  [2, oohs],
  [4, stack(oohs, bells)])`,
      },
      {
        label: 'Funk Vocal Groove',
        code: `// funk vocal groove — "Get Down"
// Get down get down and feel the funky beat
// Slap that bass and move your dancing feet
// Horns are blaring hot across the stage
// Every note is turnin up the page
// Groove so deep it echoes through the age
let synthVox = note("c4 ~ e4 f4 ~ e4 c4 ~").s("gm_synth_voice")
  .velocity(.6).room(.3)
let bass = note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.65)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.55)
let brass = note("~ [e5,g5] ~ ~ ~ [f5,a5] ~ ~").s("gm_brass1").velocity(.4)

$: arrange(
  [2, stack(synthVox, bass)],
  [2, stack(synthVox, bass, drums)],
  [4, stack(synthVox, bass, drums, brass)])`,
      },
      {
        label: 'Choir Hymn Full',
        code: `// choir hymn — "Eternal Light"
// Eternal light that guides us through the night
// Voices joined in harmony and might
// Every soul uplifted by the song
// Together we are where we all belong
// Carry us oh music all day long
let choir = note("[c4,e4,g4,c5] ~ [d4,f4,a4,d5] ~ [e4,g4,b4,e5] ~ [c4,e4,g4,c5] ~")
  .s("gm_choir_aahs").velocity(.65).room(.7).slow(4)
let organ = note("[c3,g3] ~ [d3,a3] ~ [e3,b3] ~ [c3,g3] ~")
  .s("gm_church_organ").velocity(.4).slow(4)
let kick = s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.2)

$: arrange(
  [2, choir],
  [2, stack(choir, organ)],
  [4, stack(choir, organ, kick)])`,
      },
      {
        label: 'Rock Anthem Vox',
        code: `// rock anthem vocal — "Thunder Road"
// Thunder road beneath the open sky
// Engines roar and eagles learn to fly
// Every mile a story left behind
// Searchin' for the freedom we will find
// Rock and roll forever on my mind
let choir = note("e4 e4 g4 a4 b4 a4 g4 e4").s("gm_choir_aahs")
  .velocity(.65).room(.4)
let guitar = note("[e3,b3,e4] ~ [a3,e4,a4] ~ [d3,a3,d4] ~ [e3,b3,e4] ~")
  .s("gm_overdriven_guitar").velocity(.5).slow(2)
let bass = note("e2 ~ e2 ~ a2 ~ b2 ~").s("gm_electric_bass_pick").velocity(.55)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.55)

$: arrange(
  [2, stack(choir, guitar)],
  [2, stack(choir, guitar, bass)],
  [4, stack(choir, guitar, bass, drums)])`,
      },
      {
        label: 'Ambient Vocal Wash',
        code: `// ambient vocal wash — "Ocean Hymn"
// Waves are singing to the endless shore
// Echoes drifting through an open door
// Salt and mist upon the evening breeze
// Voices carried over emerald seas
// Peace within the silence if you please
let oohs = note("<c4 d4 e4 f4 e4 d4 c4 b3>")
  .s("gm_voice_oohs").velocity(sine.range(.15,.4).slow(16))
  .room(.8).delay(.35).slow(4)
let pad = note("<[c3,e3,g3] [b2,d3,f3] [a2,c3,e3] [g2,b2,d3]>")
  .s("gm_warm_pad").velocity(.2).slow(8)

$: arrange(
  [2, oohs],
  [4, stack(oohs, pad)])`,
      },
      {
        label: 'Dancehall Vocal',
        code: `// dancehall vocal — "Bun It Up"
// Bun it up and let the speaker blow
// Riddim hot from head down to the toe
// Selecta play the tune we wanna know
// Crowd a jump and rock it high and low
// Dancehall vibes wherever that we go
let synthVox = note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_synth_voice")
  .velocity(.55).room(.3).delay(.15)
let bass = note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.6)
let drums = s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.55)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, stack(synthVox, bass)],
  [2, stack(synthVox, bass, drums)],
  [4, stack(synthVox, bass, drums, rim)])`,
      },
    ],
  },
  {
    category: 'Guitar',
    icon: '🎸',
    examples: [
      {
        label: 'Nylon Pluck',
        code: `// nylon guitar pluck
let guitar = note("c4 e4 g4 c5 g4 e4 c4 e4")
  .s("gm_nylon_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Steel Arp',
        code: `// steel string arpeggio
let guitar = note("e3 g3 b3 e4 b3 g3 e3 b2")
  .s("gm_steel_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Clean Electric',
        code: `// clean electric guitar
let guitar = note("a3 c4 e4 a4 e4 c4 a3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Overdriven Riff',
        code: `// overdriven guitar riff
let guitar = note("e2 e2 g2 a2 e2 e2 b2 a2")
  .s("gm_overdriven_guitar").velocity(.55)
  .gain(.5)

$: arrange([4, guitar])`,
      },
      {
        label: 'Distortion Power',
        code: `// distorted power chords
let guitar = note("<[e2,b2,e3] [c2,g2,c3] [d2,a2,d3] [a1,e2,a2]>")
  .s("gm_distortion_guitar").velocity(.5)
  .slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Jazz Clean',
        code: `// jazz guitar clean
let guitar = note("c3 e3 g3 b3 a3 f3 d3 g3")
  .s("gm_clean_guitar").velocity(.4)
  .room(.4).delay(.15)

$: arrange([4, guitar])`,
      },
      {
        label: 'Muted Funk',
        code: `// muted funk guitar
let guitar = note("c3 ~ c3 ~ c3 ~ c3 c3")
  .s("gm_muted_guitar").velocity(.5)
  .decay(.08)

$: arrange([4, guitar])`,
      },
      {
        label: 'Harmonics',
        code: `// guitar harmonics
let guitar = note("e5 b5 e6 b5 g5 e5 b4 e5")
  .s("gm_guitar_harmonics").velocity(.4)
  .room(.5).delay(.2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Nylon Chords',
        code: `// nylon chord strum
let guitar = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Blues Lick',
        code: `// blues guitar lick
let guitar = note("c4 e4 f4 g4 g4 b4 g4 e4")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Country Pick',
        code: `// country picking
let guitar = note("c3 e3 g3 c4 e3 g3 c4 e4")
  .s("gm_steel_guitar").velocity(.5)

$: arrange([4, guitar])`,
      },
      {
        label: 'Tremolo Pick',
        code: `// tremolo picking
let guitar = note("[e3 e3 e3 e3]*4")
  .s("gm_clean_guitar")
  .velocity("[.3 .5 .35 .55]*4")

$: arrange([4, guitar])`,
      },
      {
        label: 'Slide Guitar',
        code: `// slide guitar feel
let guitar = note("c3 d3 e3 g3 c4 g3 e3 d3")
  .s("gm_steel_guitar").velocity(.5)
  .glide(.15).room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Fingerstyle',
        code: `// fingerstyle pattern
let guitar = note("c3 g3 e4 g3 c3 g3 e4 c4")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Surf Rock',
        code: `// surf rock twang
let guitar = note("e3 g3 a3 b3 e4 b3 a3 g3")
  .s("gm_clean_guitar").velocity(.5)
  .delay(.3).delayfeedback(.4)

$: arrange([4, guitar])`,
      },
      {
        label: 'Power Slide',
        code: `// power chord slide
let guitar = note("<[e2,b2,e3] [g2,d3,g3] [a2,e3,a3] [g2,d3,g3]>")
  .s("gm_overdriven_guitar").velocity(.5)
  .slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Wah Guitar',
        code: `// wah-wah guitar
let guitar = note("e3 g3 a3 e3 g3 a3 b3 a3")
  .s("gm_clean_guitar").velocity(.5)
  .lpf(sine.range(500,4000)).lpq(6)

$: arrange([4, guitar])`,
      },
      {
        label: 'Pedal Steel',
        code: `// pedal steel vibe
let guitar = note("e3 a3 b3 e4 a4 e4 b3 a3")
  .s("gm_steel_guitar").velocity(.4)
  .room(.5).delay(.25).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Flamenco Pick',
        code: `// flamenco rapid pick
let guitar = note("[e4 f4 e4 d4]*2")
  .s("gm_nylon_guitar").velocity(.5)
  .decay(.1)

$: arrange([4, guitar])`,
      },
      {
        label: 'Guitar + Drums',
        code: `// guitar with drums
let drums = s("bd ~ bd ~, ~ sd ~ sd").gain(.7)
let hats = s("[~ hh]*4").gain(.35)
let guitar = note("c3 e3 g3 c4 g3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, guitar)])`,
      },
      {
        label: 'Acoustic Ballad',
        code: `// acoustic ballad
let guitar = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.4).slow(4)

$: arrange([4, guitar])`,
      },
      {
        label: 'Rock Riff',
        code: `// rock guitar riff
let guitar = note("e2 ~ e3 e2 g2 ~ a2 b2")
  .s("gm_overdriven_guitar").velocity(.55)

$: arrange([4, guitar])`,
      },
      {
        label: 'Octave Lead',
        code: `// octave guitar lead
let guitar = note("c4 c5 e4 e5 g4 g5 b4 b5")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Reverb Nylon',
        code: `// reverb-drenched nylon
let guitar = note("e4 b4 g4 e4")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.8).roomsize(6).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Distort Chug',
        code: `// chugging distortion
let guitar = note("[e2 e2 ~ e2]*2")
  .s("gm_distortion_guitar").velocity(.55)
  .decay(.08)

$: arrange([4, guitar])`,
      },
      {
        label: 'Clean Chorus',
        code: `// chorus clean tone
let guitar = note("c4 e4 g4 b4")
  .s("gm_clean_guitar").velocity(.45)
  .room(.5).delay(.2).delayfeedback(.35).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Ambient Guitar',
        code: `// ambient guitar pad
let guitar = note("<[c3,g3] [a2,e3]>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.8).roomsize(5)
  .delay(.4).delayfeedback(.5).slow(4)

$: arrange([4, guitar])`,
      },
      {
        label: 'Palm Mute',
        code: `// palm mute chug
let guitar = note("e2*8")
  .s("gm_muted_guitar")
  .velocity("[.3 .5 .35 .55 .3 .5 .35 .6]")

$: arrange([4, guitar])`,
      },
      {
        label: 'Staccato Strum',
        code: `// staccato chord strum
let guitar = note("[c3,e3,g3] ~ ~ [a2,c3,e3] ~ ~")
  .s("gm_steel_guitar").velocity(.5)
  .decay(.1)

$: arrange([4, guitar])`,
      },
      {
        label: 'Guitar Delay Wash',
        code: `// guitar into delay wash
let guitar = note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("gm_clean_guitar").velocity(.4)
  .delay(.5).delayfeedback(.7)
  .room(.5)

$: arrange([4, guitar])`,
      },
      {
        label: 'Fingerstyle Ballad',
        code: `// fingerstyle ballad
let guitar = note("e3 b3 g3 d4 b3 g3 e3 b2")
  .s("gm_nylon_guitar").velocity(sine.range(.3,.55).slow(8))
  .room(.45).delay(.1)
let guitar2 = note("<[e3,b3,e4] [a2,e3,a3] [d3,a3,d4] [b2,g3,b3]>")
  .s("gm_nylon_guitar").velocity(.25).slow(4)

$: arrange(
  [2, guitar],
  [4, stack(guitar, guitar2)])`,
      },
      {
        label: 'Flamenco Rasgueado',
        code: `// flamenco rasgueado strum
let guitar = note("[e3,a3,d4,g4,b4,e5] ~ ~ [e3,a3,d4,g4,b4,e5]")
  .s("gm_nylon_guitar").velocity("<.7 .5 .6 .7>")
  .room(.3)
let guitar2 = note("~ [a3,d4,g4] [a3,d4,g4] ~")
  .s("gm_nylon_guitar").velocity(.4)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, guitar],
  [2, stack(guitar, guitar2)],
  [4, stack(guitar, guitar2, kick)])`,
      },
      {
        label: 'Texas Blues Lick',
        code: `// texas blues guitar lick
let guitar = note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_overdriven_guitar").velocity(.55).room(.35)
let guitar2 = note("[e3,b3] ~ [a3,e4] ~ [d3,a3] ~ [e3,b3] ~")
  .s("gm_clean_guitar").velocity(.3).slow(2)
let bass = note("e2 ~ e2 ~ a2 ~ b2 ~").s("gm_electric_bass_finger").velocity(.5)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)

$: arrange(
  [2, stack(guitar, guitar2)],
  [2, stack(guitar, guitar2, bass)],
  [4, stack(guitar, guitar2, bass, drums)])`,
      },
      {
        label: 'Surf Rock Tremolo',
        code: `// surf rock tremolo guitar
let guitar = note("e4 e4 e4 e4 g4 g4 g4 g4")
  .s("gm_clean_guitar")
  .velocity(perlin.range(.3,.6).fast(8)).room(.4).delay(.2)
let bass = note("e2 ~ e2 g2 a2 ~ e2 ~").s("gm_electric_bass_pick").velocity(.5)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)

$: arrange(
  [2, guitar],
  [2, stack(guitar, bass)],
  [4, stack(guitar, bass, drums)])`,
      },
      {
        label: 'Jangle Pop Strum',
        code: `// jangle pop strumming
let guitar = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_clean_guitar").velocity(.45).room(.35)
let guitar2 = note("c4 e4 g4 c5 g4 e4 c4 e4")
  .s("gm_steel_guitar").velocity(.3).delay(.15)
let bass = note("c2 c2 a2 a2 f2 f2 g2 g2").s("gm_electric_bass_finger").velocity(.45)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)

$: arrange(
  [2, stack(guitar, guitar2)],
  [2, stack(guitar, guitar2, bass)],
  [4, stack(guitar, guitar2, bass, drums)])`,
      },
      {
        label: 'Metal Power Chords',
        code: `// metal power chord riff
let guitar = note("[e2,b2,e3] ~ [g2,d3,g3] [a2,e3,a3] ~ [e2,b2,e3] ~ ~")
  .s("gm_distortion_guitar").velocity(.7).room(.25)
let bass = note("e1 ~ g1 a1 ~ e1 ~ ~").s("gm_synth_bass_1").velocity(.65)
let drums = s("bd bd sd ~ bd bd sd bd").bank("RolandTR909").gain(.6)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.35)

$: arrange(
  [2, stack(guitar, bass)],
  [2, stack(guitar, bass, drums)],
  [4, stack(guitar, bass, drums, hats)])`,
      },
      {
        label: 'Bossa Nova Guitar',
        code: `// bossa nova guitar comp
let guitar = note("[d3,a3,d4] ~ [d3,a3,d4] ~ [c3,g3,c4] ~ [c3,g3,c4] ~")
  .s("gm_nylon_guitar").velocity(.4).room(.3)
let bass = note("d2 ~ a2 ~ c2 ~ g2 ~").s("gm_acoustic_bass").velocity(.45)
let rim = s("~ rim ~ rim ~ rim ~ rim").bank("RolandTR808").gain(.25)

$: arrange(
  [2, guitar],
  [2, stack(guitar, bass)],
  [4, stack(guitar, bass, rim)])`,
      },
      {
        label: 'Reggae Skank',
        code: `// reggae guitar skank
let guitar = note("~ [b3,d4,f4] ~ [b3,d4,f4] ~ [a3,c4,e4] ~ [a3,c4,e4]")
  .s("gm_muted_guitar").velocity(.5).room(.2)
let bass = note("~ b2 ~ b2 ~ a2 ~ a2").s("gm_electric_bass_finger").velocity(.55)
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
let hats = s("~ ~ hh ~ ~ ~ hh ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(guitar, bass)],
  [2, stack(guitar, bass, drums)],
  [4, stack(guitar, bass, drums, hats)])`,
      },
      {
        label: 'Country Chicken Pick',
        code: `// country chicken pickin
let guitar = note("e4 a4 a4 b4 a4 a4 e4 d4")
  .s("gm_clean_guitar").velocity("<.6 .4 .5 .6>").room(.25)
let guitar2 = note("a2 e3 a2 e3 d3 a3 e3 b3").s("gm_steel_guitar").velocity(.35)
let bass = note("a2 ~ e2 ~ d2 ~ e2 ~").s("gm_acoustic_bass").velocity(.45)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, stack(guitar, guitar2)],
  [2, stack(guitar, guitar2, bass)],
  [4, stack(guitar, guitar2, bass, drums)])`,
      },
      {
        label: 'Shoegaze Shimmer',
        code: `// shoegaze shimmer guitar
let guitar = note("<[e4,b4] [c4,g4] [a3,e4] [d4,a4]>")
  .s("gm_clean_guitar").velocity(.35)
  .room(.8).delay(.4).delayfeedback(.6).slow(4)
let guitar2 = note("<e3 c3 a2 d3>")
  .s("gm_distortion_guitar").velocity(.3).room(.7).slow(4)
let drums = s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.3)

$: arrange(
  [2, guitar],
  [2, stack(guitar, guitar2)],
  [4, stack(guitar, guitar2, drums)])`,
      },
      {
        label: 'Jazz Comping Guitar',
        code: `// jazz guitar comping
let guitar = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_clean_guitar").velocity(.4).room(.3).slow(2)
let bass = note("d2 a2 g2 d3 c2 g2 f2 c3").s("gm_acoustic_bass").velocity(.45)
let hats = s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)

$: arrange(
  [2, guitar],
  [2, stack(guitar, bass)],
  [4, stack(guitar, bass, hats)])`,
      },
      {
        label: 'Funk Wah Guitar',
        code: `// funk wah guitar rhythm
let guitar = note("e3 ~ [e3,g3] ~ e3 [e3,g3] ~ e3")
  .s("gm_muted_guitar").velocity(.55).lpf(sine.range(400,3000).fast(4))
let bass = note("e2 ~ e2 g2 ~ e2 ~ g2").s("gm_slap_bass_1").velocity(.55)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
let hats = s("oh ~ hh hh oh ~ hh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(guitar, bass)],
  [2, stack(guitar, bass, drums)],
  [4, stack(guitar, bass, drums, hats)])`,
      },
      {
        label: 'Classical Duet',
        code: `// classical guitar duet  
let guitar = note("e4 f4 g4 a4 b4 c5 b4 a4")
  .s("gm_nylon_guitar").velocity(.45).room(.4)
let guitar2 = note("c3 e3 g3 c3 d3 f3 a3 d3")
  .s("gm_nylon_guitar").velocity(.35).room(.4)

$: arrange(
  [2, guitar],
  [4, stack(guitar, guitar2)])`,
      },
      {
        label: 'Grunge Riff',
        code: `// grunge guitar riff
let guitar = note("[e2,b2] ~ [g2,d3] ~ [a2,e3] ~ [e2,b2] [f2,c3]")
  .s("gm_distortion_guitar").velocity(.65).room(.3)
let bass = note("e1 ~ g1 ~ a1 ~ e1 f1").s("gm_electric_bass_pick").velocity(.6)
let drums = s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR909").gain(.55)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR909").gain(.35)

$: arrange(
  [2, stack(guitar, bass)],
  [2, stack(guitar, bass, drums)],
  [4, stack(guitar, bass, drums, hats)])`,
      },
      {
        label: 'Harmonics Sparkle',
        code: `// guitar harmonics sparkle
let guitar = note("e5 b4 g5 d5 ~ e5 b4 ~")
  .s("gm_guitar_harmonics").velocity(.4).room(.6).delay(.3)
let guitar2 = note("e3 b3 g3 d4 b3 g3 e3 b2")
  .s("gm_nylon_guitar").velocity(.3).room(.4)

$: arrange(
  [2, guitar],
  [4, stack(guitar, guitar2)])`,
      },
      {
        label: 'Rockabilly Twang',
        code: `// rockabilly twang guitar
let guitar = note("e4 g4 a4 b4 ~ e4 g4 b4")
  .s("gm_steel_guitar").velocity(.55).room(.25).delay(.1)
let bass = note("e2 b2 e2 b2 a2 e3 a2 e3").s("gm_acoustic_bass").velocity(.5)
let drums = s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.5)

$: arrange(
  [2, guitar],
  [2, stack(guitar, bass)],
  [4, stack(guitar, bass, drums)])`,
      },
      {
        label: 'Slide Guitar Blues',
        code: `// slide guitar blues
let guitar = note("e3 ~ g3 a3 ~ b3 a3 g3")
  .s("gm_steel_guitar").velocity(sine.range(.35,.6).slow(4)).room(.4)
let guitar2 = note("[e3,b3] ~ [a3,e4] ~ [b3,g4] ~ [e3,b3] ~")
  .s("gm_clean_guitar").velocity(.3).slow(2)
let bass = note("e2 ~ a2 ~ b2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.45)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, stack(guitar, guitar2)],
  [2, stack(guitar, guitar2, bass)],
  [4, stack(guitar, guitar2, bass, drums)])`,
      },
      {
        label: 'Ambient Guitar Pad',
        code: `// ambient guitar pad
let guitar = note("<c4 e4 g4 b4>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.85).delay(.5).delayfeedback(.65).slow(4)
let guitar2 = note("<[c3,g3] [a2,e3] [f2,c3] [g2,d3]>")
  .s("gm_clean_guitar").velocity(.2).room(.7).slow(8)

$: arrange(
  [2, guitar],
  [4, stack(guitar, guitar2)])`,
      },
      {
        label: 'Acoustic Folk Strum',
        code: `// acoustic folk strumming
let guitar = note("<[g3,b3,d4] [c3,e3,g3] [d3,g3,a3] [g3,b3,d4]>")
  .s("gm_steel_guitar").velocity(.5).room(.35)
let guitar2 = note("g3 b3 d4 g4 d4 b3 g3 b3")
  .s("gm_steel_guitar").velocity(.3)
let bass = note("g2 g2 c2 c2 d2 d2 g2 g2").s("gm_acoustic_bass").velocity(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(guitar, guitar2)],
  [2, stack(guitar, guitar2, bass)],
  [4, stack(guitar, guitar2, bass, drums)])`,
      },
    ],
  },
  {
    category: 'Claps',
    icon: '👏',
    examples: [
      {
        label: 'Basic Clap',
        code: `// simple clap pattern
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.7)

$: arrange([4, clap])`,
      },
      {
        label: 'Double Clap',
        code: `// doubled clap hit
let clap = s("~ [cp cp] ~ ~").bank("RolandTR909").gain(.65)
  .room(.15)

$: arrange([4, clap])`,
      },
      {
        label: 'Clap Stack',
        code: `// layered 808+909 claps
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let clap2 = s("~ cp ~ ~").bank("RolandTR808").gain(.4)

$: arrange(
  [2, clap],
  [4, stack(clap, clap2)])`,
      },
      {
        label: 'Off-Beat Claps',
        code: `// off-beat clap groove
let clap = s("~ cp ~ [~ cp]").bank("RolandTR808").gain(.65)
let kick = s("bd ~ bd ~").bank("RolandTR808").gain(.8)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Triplet Claps',
        code: `// triplet clap pattern
let clap = s("cp(3,8)").bank("RolandTR909").gain(.6)
let kick = s("bd*4").gain(.8)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Clap Roll',
        code: `// clap roll buildup
let clap = s("[~ ~ ~ ~] [~ ~ cp ~] [~ cp cp ~] [cp cp cp cp]")
  .bank("RolandTR909").gain(.6)

$: arrange([4, clap])`,
      },
      {
        label: 'Clap + Snare',
        code: `// clap layered with snare
let clap = s("~ [cp sd] ~ [cp sd]").bank("RolandTR808")
  .gain(.65).room(.2)

$: arrange([4, clap])`,
      },
      {
        label: 'Delayed Clap',
        code: `// clap with echo
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
  .delay(.4).delayfeedback(.5).room(.3)

$: arrange([4, clap])`,
      },
      {
        label: 'Reverb Clap',
        code: `// reverb-soaked clap
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.55)
  .room(.8).roomsize(6)

$: arrange([4, clap])`,
      },
      {
        label: 'Syncopated Claps',
        code: `// syncopated clap groove
let clap = s("~ cp ~ cp ~ ~ cp ~").bank("RolandTR808").gain(.6)
let kick = s("bd*4").gain(.8)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Clap Gate',
        code: `// gated clap stutter
let clap = s("cp*8").bank("RolandTR909")
  .gain("[0 .5 0 .6 0 .5 0 .7]")

$: arrange([4, clap])`,
      },
      {
        label: 'Clap Shuffle',
        code: `// shuffled clap feel
let clap = s("~ cp [~ cp] ~").bank("RolandTR909").gain(.6)
let kick = s("bd [~ bd] bd ~").gain(.8)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Clap Flam',
        code: `// flam clap hit
let clap = s("~ [cp:0 cp:1] ~ ~").bank("RolandTR808")
  .gain("[.3 .6]").room(.2)

$: arrange([4, clap])`,
      },
      {
        label: 'Clap Euclidean',
        code: `// euclidean clap pattern
let clap = s("cp(5,16)").bank("RolandTR909").gain(.55)
let kick = s("bd(3,8)").gain(.8)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Trap Clap',
        code: `// trap style clap
let clap = s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.7)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.85)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Garage Clap',
        code: `// 2-step garage clap
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let kick = s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
let hats = s("[hh hh hh ~]*2").gain(.4)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Clap Panned',
        code: `// stereo clap spread
let clap = s("~ cp ~ cp").bank("RolandTR909")
  .gain(.55).pan("<.2 .8>")

$: arrange([4, clap])`,
      },
      {
        label: 'Crushed Clap',
        code: `// bit-crushed clap
let clap = s("~ cp ~ ~").bank("RolandTR808").gain(.6)
  .crush(8)

$: arrange([4, clap])`,
      },
      {
        label: 'Clap Drive',
        code: `// driving clap pattern
let clap = s("cp*4").bank("RolandTR909")
  .gain("[.3 .6 .35 .65]")

$: arrange([4, clap])`,
      },
      {
        label: 'Reggaeton Clap',
        code: `// reggaeton clap
let clap = s("~ ~ cp ~ ~ ~ cp ~").bank("RolandTR808").gain(.6)
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.85)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Afro Clap',
        code: `// afrobeat clap
let clap = s("cp(2,8)").bank("RolandTR808").gain(.55)
let kick = s("bd(3,8)").bank("RolandTR808").gain(.8)
let rim = s("rim(5,8)").bank("RolandTR808").gain(.35)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, rim)])`,
      },
      {
        label: 'DnB Clap',
        code: `// drum and bass clap
let clap = s("[~ ~ ~ ~] [~ cp ~ ~]").bank("RolandTR909").gain(.65)
let kick = s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Minimal Clap',
        code: `// minimal clap tick
let clap = s("~ cp ~ ~").gain(.5)
let kick = s("bd*4").gain(.7)
let hats = s("hh*16").gain("[.15 .25]*8")

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Clap + Rim',
        code: `// clap and rim combo
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let rim = s("rim*8").bank("RolandTR909").gain("[.15 .3]*4")

$: arrange(
  [2, clap],
  [4, stack(clap, rim)])`,
      },
      {
        label: 'Pitched Clap',
        code: `// pitched clap melody
let clap = s("cp cp cp cp").bank("RolandTR808")
  .speed("<1 1.25 .85 1.5>").gain(.55)

$: arrange([4, clap])`,
      },
      {
        label: 'Clap Delay Tail',
        code: `// long delay tail clap
let clap = s("~ ~ ~ cp").bank("RolandTR909").gain(.5)
  .delay(.6).delayfeedback(.7).room(.4)

$: arrange([4, clap])`,
      },
      {
        label: 'Lo-Fi Clap',
        code: `// lo-fi dusty clap
let clap = s("~ cp ~ ~").bank("RolandTR808").gain(.5)
  .lpf(2000).room(.3)

$: arrange([4, clap])`,
      },
      {
        label: 'Polyrhythm Clap',
        code: `// polyrhythm claps
let clap = s("cp(3,8)").bank("RolandTR909").gain(.5)
let clap2 = s("cp(5,8)").bank("RolandTR808").gain(.35)

$: arrange(
  [2, clap],
  [4, stack(clap, clap2)])`,
      },
      {
        label: 'House Clap',
        code: `// four-on-floor clap
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.65)
let hats = s("[~ hh]*4").bank("RolandTR909").gain(.45)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Clap Fill',
        code: `// clap fill pattern
let clap = s("~ cp ~ ~, ~ ~ [cp cp] ~, ~ ~ ~ [~ cp]")
  .bank("RolandTR909").gain(.55)

$: arrange([4, clap])`,
      },
      {
        label: 'Trap Clap Rolls',
        code: `// trap style clap rolls
let clap = s("~ ~ cp ~ ~ ~ [cp cp cp] ~")
  .bank("RolandTR808").gain(.6)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
let hats = s("hh hh hh hh hh oh hh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Gospel Clap',
        code: `// gospel hand clap groove
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.65)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.5)
let organ = note("[c4,e4,g4] ~ [f4,a4,c5] ~").s("gm_church_organ").velocity(.3).slow(2)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, organ)])`,
      },
      {
        label: 'Swing Clap',
        code: `// swing feel clap
let clap = s("~ cp ~ [~ cp]").bank("RolandTR909").gain(.55)
let kick = s("bd ~ bd ~").bank("RolandTR909").gain(.45)
let hats = s("[hh ~] [hh hh] [hh ~] [hh hh]").bank("RolandTR909").gain(.3)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Stadium Clap',
        code: `// stadium crowd clap
let clap = s("cp ~ cp ~").bank("RolandTR808").gain(.7).room(.6)
let clap2 = s("~ ~ cp ~").bank("RolandTR909").gain(.4).room(.6).delay(.15)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, clap],
  [2, stack(clap, clap2)],
  [4, stack(clap, clap2, kick)])`,
      },
      {
        label: 'Polyrhythm Clap',
        code: `// polyrhythmic clap pattern
let clap = s("cp ~ ~ cp ~ ~").bank("RolandTR909").gain(.55)
let clap2 = s("~ cp ~ ~ cp ~").bank("RolandTR808").gain(.45)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.4)

$: arrange(
  [2, clap],
  [2, stack(clap, clap2)],
  [4, stack(clap, clap2, kick)])`,
      },
      {
        label: 'Clap Delay Trail',
        code: `// clap with long delay trail
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.5)
  .delay(.35).delayfeedback(.6).room(.4)
let drums = s("bd ~ sd ~").bank("RolandTR909").gain(.5)

$: arrange(
  [2, clap],
  [4, stack(clap, drums)])`,
      },
      {
        label: 'Double Time Clap',
        code: `// double time clap rhythm
let clap = s("~ cp ~ cp ~ cp ~ cp").bank("RolandTR909").gain(.5)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)

$: arrange(
  [2, clap],
  [2, stack(clap, drums)],
  [4, stack(clap, drums, hats)])`,
      },
      {
        label: 'Flam Clap',
        code: `// flam clap accents
let clap = s("~ [cp ~ cp] ~ ~").bank("RolandTR909").gain("<.5 .6 .55 .65>")
  .room(.2)
let drums = s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, clap],
  [4, stack(clap, drums)])`,
      },
      {
        label: 'Afro Clap Pattern',
        code: `// afrobeat clap pattern
let clap = s("~ cp ~ ~ cp ~ cp ~").bank("RolandTR808").gain(.55)
let kick = s("bd ~ bd ~ ~ bd ~ bd").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Clap + Snap Layer',
        code: `// layered clap with rim snap
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.55)
let rim = s("~ rim ~ ~").bank("RolandTR808").gain(.35).delay(.05)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)

$: arrange(
  [2, clap],
  [2, stack(clap, rim)],
  [4, stack(clap, rim, drums)])`,
      },
      {
        label: 'House Clap Groove',
        code: `// classic house clap
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6).room(.15)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.6)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.35)
let piano = note("~ ~ c4 ~").s("gm_epiano1").velocity(.2)

$: arrange(
  [2, stack(clap, kick)],
  [2, stack(clap, kick, hats)],
  [4, stack(clap, kick, hats, piano)])`,
      },
      {
        label: 'Reggaeton Clap',
        code: `// reggaeton clap dembow
let clap = s("~ ~ cp ~ ~ ~ cp ~").bank("RolandTR808").gain(.6)
let kick = s("bd ~ ~ bd ~ bd ~ ~").bank("RolandTR808").gain(.55)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, hats)])`,
      },
      {
        label: 'Buildup Clap',
        code: `// buildup accelerating clap
let clap = s("cp ~ ~ ~ cp ~ cp [cp cp cp cp]")
  .bank("RolandTR909").gain(sine.range(.3,.7).slow(4))
let kick = s("bd ~ ~ ~ bd ~ bd bd").bank("RolandTR909").gain(.5)

$: arrange(
  [2, clap],
  [4, stack(clap, kick)])`,
      },
      {
        label: 'Minimal Clap',
        code: `// minimal techno clap
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.5)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.55)
let hats = s("hh ~ hh ~ hh ~ hh ~").bank("RolandTR909").gain(.2)
let rim = s("~ ~ ~ rim ~ ~ ~ ~").bank("RolandTR808").gain(.25)

$: arrange(
  [2, stack(clap, kick)],
  [2, stack(clap, kick, hats)],
  [4, stack(clap, kick, hats, rim)])`,
      },
      {
        label: 'Dancehall Clap',
        code: `// dancehall clap riddim
let clap = s("~ cp cp ~ ~ cp ~ cp").bank("RolandTR808").gain(.55)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.5)
let rim = s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, clap],
  [2, stack(clap, kick)],
  [4, stack(clap, kick, rim)])`,
      },
      {
        label: 'Syncopated Clap',
        code: `// syncopated clap groove
let clap = s("~ cp ~ [~ cp] ~ cp ~ ~").bank("RolandTR909").gain(.5)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
let bass = note("c3 ~ e3 ~ f3 ~ e3 ~").s("gm_synth_bass_1").velocity(.3)

$: arrange(
  [2, clap],
  [2, stack(clap, drums)],
  [4, stack(clap, drums, bass)])`,
      },
      {
        label: 'Clap Gate',
        code: `// gated clap rhythm
let clap = s("cp cp ~ cp cp ~ cp ~")
  .bank("RolandTR909").gain("<.5 .3 .6 .4 .5 .3 .6 .4>")
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)

$: arrange(
  [2, clap],
  [4, stack(clap, drums)])`,
      },
      {
        label: 'Latin Clap',
        code: `// latin clave with clap
let clap = s("cp ~ ~ cp ~ cp ~ ~").bank("RolandTR808").gain(.5)
let rim = s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.35)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.45)
let bass = note("~ a2 ~ a2 ~ c3 ~ a2").s("gm_acoustic_bass").velocity(.4)

$: arrange(
  [2, stack(clap, rim)],
  [2, stack(clap, rim, kick)],
  [4, stack(clap, rim, kick, bass)])`,
      },
      {
        label: 'Philly Soul Clap',
        code: `// philly soul clap groove
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.55).room(.2)
let kick = s("bd ~ ~ ~ bd ~ ~ bd").bank("RolandTR808").gain(.45)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)
let strings = note("[c4,e4,g4] ~ [f4,a4,c5] ~").s("gm_strings1").velocity(.2).slow(2)

$: arrange(
  [2, stack(clap, kick)],
  [2, stack(clap, kick, hats)],
  [4, stack(clap, kick, hats, strings)])`,
      },
      {
        label: 'Stacked Clap Hit',
        code: `// stacked multi-layer clap
let clap = s("~ cp ~ ~").bank("RolandTR808").gain(.5)
let clap2 = s("~ cp ~ ~").bank("RolandTR909").gain(.45).delay(.02)
let snare = s("~ sd ~ ~").bank("RolandTR808").gain(.3)
let drums = s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, stack(clap, clap2)],
  [2, stack(clap, clap2, snare)],
  [4, stack(clap, clap2, snare, drums)])`,
      },
    ],
  },
  {
    category: 'Reverb',
    icon: '🏛️',
    examples: [
      {
        label: 'Cathedral Piano',
        code: `// cathedral reverb piano
let piano = note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("piano").gain(.45)
  .room(.95).roomsize(10)

$: arrange([4, piano])`,
      },
      {
        label: 'Infinite Verb',
        code: `// infinite reverb wash
let lead = note("c4").s("sine").gain(.3)
  .room(.99).roomsize(12)
  .delay(.5).delayfeedback(.7)

$: arrange([4, lead])`,
      },
      {
        label: 'Shimmer Pad',
        code: `// shimmering reverb pad
let pad = note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.9).roomsize(8)
  .delay(.3).delayfeedback(.5).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Plate Snare',
        code: `// plate reverb on snare
let snare = s("~ sd ~ sd").gain(.65)
  .room(.7).roomsize(4)
let kick = s("bd*4").gain(.8)

$: arrange(
  [2, snare],
  [4, stack(snare, kick)])`,
      },
      {
        label: 'Hall Strings',
        code: `// concert hall strings
let strings = note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_strings1").velocity(.4)
  .room(.85).roomsize(8).slow(4)

$: arrange([4, strings])`,
      },
      {
        label: 'Reverb Hats',
        code: `// reverb-soaked hi-hats
let hats = s("hh*8").gain("[.3 .5]*4")
  .room(.6).roomsize(4)
let kick = s("bd*4").gain(.8)

$: arrange(
  [2, hats],
  [4, stack(hats, kick)])`,
      },
      {
        label: 'Ambient Bell',
        code: `// reverb bell tones
let bells = note("<c5 e5 g5 b5>")
  .s("gm_tubular_bells").velocity(.35)
  .room(.9).roomsize(8).slow(2)

$: arrange([4, bells])`,
      },
      {
        label: 'Verb + Delay',
        code: `// reverb and delay combo
let piano = note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("piano").gain(.4)
  .room(.7).roomsize(5)
  .delay(.4).delayfeedback(.5)

$: arrange([4, piano])`,
      },
      {
        label: 'Gated Verb',
        code: `// gated reverb snare
let snare = s("~ sd ~ sd").gain(.7)
  .room(.8).roomsize(3)
let kick = s("bd*4").gain(.85)

$: arrange(
  [2, snare],
  [4, stack(snare, kick)])`,
      },
      {
        label: 'Spring Verb',
        code: `// spring reverb guitar
let guitar = note("e3 g3 a3 b3 e4 b3 a3 g3")
  .s("gm_clean_guitar").velocity(.45)
  .room(.6).roomsize(3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Reverse Verb',
        code: `// reverse reverb feel
let pad = note("[c4,e4,g4]").s("supersaw")
  .gain(.3).attack(.5)
  .room(.9).roomsize(8).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Vocal Cathedral',
        code: `// vocal in cathedral
let vox = s("chin:0 ~ chin:1 ~").gain(.5)
  .room(.95).roomsize(10).slow(2)

$: arrange([4, vox])`,
      },
      {
        label: 'Reverb Wash',
        code: `// pad reverb wash
let pad = note("[c3,e3,g3]").s("sawtooth")
  .gain(.25).lpf(1500)
  .room(.9).roomsize(8)

$: arrange([4, pad])`,
      },
      {
        label: 'Subtle Room',
        code: `// subtle room ambience
let piano = note("c4 e4 g4 c5 g4 e4")
  .s("piano").gain(.5)
  .room(.3).roomsize(2)

$: arrange([4, piano])`,
      },
      {
        label: 'Huge Verb',
        code: `// massive reverb space
let lead = note("c3").s("sine").gain(.35)
  .room(.95).roomsize(12)
  .lpf(800)

$: arrange([4, lead])`,
      },
      {
        label: 'Choir Hall',
        code: `// choir in concert hall
let choir = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.85).roomsize(7).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Wet Drums',
        code: `// fully wet drum reverb
let drums = s("bd sd:2 [~ bd] sd").bank("RolandTR808")
  .gain(.6).room(.8).roomsize(6)

$: arrange([4, drums])`,
      },
      {
        label: 'Small Room',
        code: `// small room feel
let bells = note("c4 e4 g4 c5")
  .s("gm_vibraphone").velocity(.45)
  .room(.25).roomsize(1)

$: arrange([4, bells])`,
      },
      {
        label: 'Verb Swell',
        code: `// reverb swell pad
let pad = note("<[c3,g3,c4]>")
  .s("sine")
  .gain(sine.range(.1,.4).slow(8))
  .room(.9).roomsize(8)

$: arrange([4, pad])`,
      },
      {
        label: 'Echo Chamber',
        code: `// echo chamber effect
let piano = note("c4 ~ ~ ~ e4 ~ ~ ~")
  .s("piano").gain(.4)
  .room(.7).roomsize(5)
  .delay(.3).delayfeedback(.6)

$: arrange([4, piano])`,
      },
      {
        label: 'Verb Piano Chord',
        code: `// reverb piano chords
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("piano").gain(.4)
  .room(.8).roomsize(6).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Ethereal Sine',
        code: `// ethereal sine reverb
let lead = note("c5 e5 g5 b5")
  .s("sine").gain(.3)
  .room(.9).roomsize(8)
  .delay(.4).delayfeedback(.5).slow(2)

$: arrange([4, lead])`,
      },
      {
        label: 'Frozen Verb',
        code: `// frozen reverb drone
let bass = note("[c2,g2]").s("sawtooth")
  .gain(.2).lpf(500)
  .room(.99).roomsize(12)

$: arrange([4, bass])`,
      },
      {
        label: 'Harp Reverb',
        code: `// harp with reverb
let harp = n("0 2 4 5 7 9 11 12")
  .scale("C4:major")
  .s("gm_harp").velocity(.4)
  .room(.7).roomsize(5).slow(2)

$: arrange([4, harp])`,
      },
      {
        label: 'Rim Plate',
        code: `// rim with plate verb
let rim = s("rim*4").gain(.4)
  .room(.6).roomsize(3)
let kick = s("bd ~ bd ~").gain(.7)

$: arrange(
  [2, rim],
  [4, stack(rim, kick)])`,
      },
      {
        label: 'Spacious Keys',
        code: `// spacious electric piano
let keys = note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.75).roomsize(5).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Verb Bass',
        code: `// reverb bass tone
let sub = note("<c2 e2 f2 g2>")
  .s("sine").gain(.45)
  .room(.5).roomsize(3)
  .lpf(300)

$: arrange([4, sub])`,
      },
      {
        label: 'Guitar Hall',
        code: `// guitar in hall
let guitar = note("e3 g3 b3 e4")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.8).roomsize(6).slow(2)

$: arrange([4, guitar])`,
      },
      {
        label: 'Synth Cathedral',
        code: `// synth in cathedral
let pad = note("[c3,e3,g3]").s("supersaw")
  .gain(.25).lpf(2000)
  .room(.9).roomsize(8)

$: arrange([4, pad])`,
      },
      {
        label: 'Reverb Everything',
        code: `// everything reverbed
let drums = s("bd sd [~ bd] sd").bank("RolandTR808").gain(.6).room(.6)
let keys = note("<[c3,e3,g3]>")
  .s("piano").gain(.4).room(.8).roomsize(6)
let sub = note("c2").s("sine").gain(.4).room(.5)

$: arrange(
  [2, drums],
  [2, stack(drums, keys)],
  [4, stack(drums, keys, sub)])`,
      },
      {
        label: 'Spring Reverb Guitar',
        code: `// spring reverb guitar twang
let guitar = note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_clean_guitar").velocity(.45)
  .room(.65).roomsize(3).delay(.1)
let bass = note("e2 ~ a2 ~ b2 ~ e2 ~").s("gm_acoustic_bass").velocity(.4).room(.3)

$: arrange(
  [2, guitar],
  [4, stack(guitar, bass)])`,
      },
      {
        label: 'Plate Verb Piano',
        code: `// plate reverb on piano
let piano = note("c4 e4 g4 c5 g4 e4 c4 ~")
  .s("gm_grandpiano").velocity(.5)
  .room(.75).roomsize(5)
let keys = note("<[c3,e3,g3] [a2,c3,e3]>").s("gm_grandpiano").velocity(.25).room(.6).slow(4)

$: arrange(
  [2, piano],
  [4, stack(piano, keys)])`,
      },
      {
        label: 'Verb Snare Wash',
        code: `// massive reverb snare wash
let snare = s("~ sd ~ ~").bank("RolandTR909").gain(.55)
  .room(.9).roomsize(8)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.5).room(.3)
let hats = s("hh hh hh hh").bank("RolandTR909").gain(.25).room(.2)

$: arrange(
  [2, snare],
  [2, stack(snare, kick)],
  [4, stack(snare, kick, hats)])`,
      },
      {
        label: 'Hall Strings',
        code: `// concert hall strings
let strings = note("<[c4,e4,g4] [d4,f4,a4] [e4,g4,b4] [c4,e4,g4]>")
  .s("gm_strings1").velocity(.5)
  .room(.85).roomsize(9).slow(4)
let strings2 = note("c3 d3 e3 c3").s("gm_cello").velocity(.3).room(.7).slow(4)

$: arrange(
  [2, strings],
  [4, stack(strings, strings2)])`,
      },
      {
        label: 'Ambient Verb Pad',
        code: `// ambient reverb pad
let pad = note("<[c4,e4,g4] [b3,d4,f4]>")
  .s("gm_warm_pad").velocity(.35)
  .room(.9).roomsize(10).slow(8)
let bells = note("c5 ~ e5 ~ g5 ~ ~ ~")
  .s("gm_celesta").velocity(.2).room(.8).delay(.3)

$: arrange(
  [2, pad],
  [4, stack(pad, bells)])`,
      },
      {
        label: 'Gated Verb Drums',
        code: `// gated reverb drums
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.6)
  .room(.7).roomsize(4).decay(.1)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3).room(.2)
let sub = note("c2 ~ c2 ~").s("sine").gain(.35).room(.3)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, sub)])`,
      },
      {
        label: 'Shimmer Verb',
        code: `// shimmer reverb effect
let bells = note("c5 e5 g5 b5 g5 e5 c5 ~")
  .s("gm_music_box").velocity(.35)
  .room(.85).roomsize(8).delay(.25).delayfeedback(.5)
let pad = note("<[c4,g4] [a3,e4]>").s("gm_halo_pad").velocity(.2).room(.7).slow(8)

$: arrange(
  [2, bells],
  [4, stack(bells, pad)])`,
      },
      {
        label: 'Reverse Verb Feel',
        code: `// reverse reverb feel
let oohs = note("~ ~ ~ c4 ~ ~ ~ e4")
  .s("gm_voice_oohs").velocity(.4)
  .room(.8).roomsize(7).delay(.4).delayfeedback(.55)
let kick = s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.4).room(.5)

$: arrange(
  [2, oohs],
  [4, stack(oohs, kick)])`,
      },
      {
        label: 'Room Drum Kit',
        code: `// room mic drum kit
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5).room(.45).roomsize(3)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3).room(.35)
let rim = s("~ ~ ~ ~ ~ ~ ~ rim").bank("RolandTR808").gain(.25).room(.4)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, rim)])`,
      },
      {
        label: 'Verb Choir Swell',
        code: `// reverb choir swell
let choir = note("[c4,e4,g4,c5]")
  .s("gm_choir_aahs").velocity(sine.range(.15,.55).slow(8))
  .room(.85).roomsize(9).slow(4)
let organ = note("[c3,g3]").s("gm_church_organ").velocity(.2).room(.7).slow(4)

$: arrange(
  [2, choir],
  [4, stack(choir, organ)])`,
      },
      {
        label: 'Tight Room Bass',
        code: `// tight room on bass
let bass = note("c2 ~ e2 ~ f2 ~ e2 ~")
  .s("gm_electric_bass_finger").velocity(.55)
  .room(.25).roomsize(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45).room(.2)

$: arrange(
  [2, bass],
  [4, stack(bass, drums)])`,
      },
      {
        label: 'Cavernous Hits',
        code: `// cavernous percussion hits
let kick = s("bd ~ ~ ~ ~ ~ ~ ~").bank("RolandTR808").gain(.6)
  .room(.95).roomsize(10)
let snare = s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.5)
  .room(.9).roomsize(9)
let bells = note("~ ~ ~ ~ ~ ~ ~ c5").s("gm_tubular_bells").velocity(.3).room(.85)

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, bells)])`,
      },
      {
        label: 'Verb Flute Echo',
        code: `// reverbed flute echo
let flute = note("g5 a5 b5 d6 b5 a5 g5 ~")
  .s("gm_flute").velocity(.4)
  .room(.75).delay(.2).delayfeedback(.4)
let pad = note("<[g3,b3,d4] [c4,e4,g4]>").s("gm_warm_pad").velocity(.2).room(.6).slow(4)

$: arrange(
  [2, flute],
  [4, stack(flute, pad)])`,
      },
      {
        label: 'Wet Dry Mix',
        code: `// wet/dry reverb contrast
let piano = note("c4 e4 g4 c5").s("gm_epiano1").velocity(.45).room(.8).roomsize(6)
let piano2 = note("c4 e4 g4 c5").s("gm_epiano2").velocity(.35).room(.1)
let drums = s("bd ~ sd ~").bank("RolandTR808").gain(.4).room(.15)

$: arrange(
  [2, piano],
  [2, stack(piano, piano2)],
  [4, stack(piano, piano2, drums)])`,
      },
      {
        label: 'Space Harp',
        code: `// space harp with deep reverb
let harp = note("c4 e4 g4 c5 e5 c5 g4 e4")
  .s("gm_harp").velocity(.4)
  .room(.85).roomsize(8).delay(.15)
let harp2 = note("<[c3,g3,c4]>").s("gm_harp").velocity(.2).room(.7).slow(8)

$: arrange(
  [2, harp],
  [4, stack(harp, harp2)])`,
      },
      {
        label: 'Verb Trail Build',
        code: `// reverb trail buildup
let bells = note("c4 ~ ~ ~ d4 ~ ~ ~ e4 ~ ~ ~ g4 ~ ~ ~")
  .s("gm_vibraphone").velocity(sine.range(.2,.5).slow(4))
  .room(sine.range(.3,.9).slow(4)).slow(2)
let kick = s("~ ~ ~ ~ ~ ~ ~ bd").bank("RolandTR808").gain(.3).room(.5)

$: arrange(
  [2, bells],
  [4, stack(bells, kick)])`,
      },
      {
        label: 'Dual Verb Space',
        code: `// dual reverb spaces
let piano = note("e4 g4 b4 e5").s("gm_grandpiano").velocity(.4)
  .room(.85).roomsize(8)
let piano2 = note("e3 g3 b3 e4").s("gm_epiano1").velocity(.35)
  .room(.35).roomsize(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.4).room(.3)

$: arrange(
  [2, piano],
  [2, stack(piano, piano2)],
  [4, stack(piano, piano2, drums)])`,
      },
      {
        label: 'Frozen Verb Pad',
        code: `// frozen reverb pad texture
let pad = note("<c4 e4 g4 b4>")
  .s("gm_bowed_glass").velocity(.3)
  .room(.95).roomsize(10).delay(.4).delayfeedback(.6).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'Verb Percussion',
        code: `// reverbed world percussion
let kick = s("bd ~ rim ~ bd rim ~ ~").bank("RolandTR808").gain(.45).room(.55)
let bells = note("c4 ~ e4 ~ g4 ~ c4 ~").s("gm_kalimba").velocity(.35).room(.65)
let bells2 = note("~ c5 ~ e5 ~ g5 ~ ~").s("gm_xylophone").velocity(.25).room(.7)

$: arrange(
  [2, kick],
  [2, stack(kick, bells)],
  [4, stack(kick, bells, bells2)])`,
      },
      {
        label: 'Verb Feedback Loop',
        code: `// reverb feedback loop
let pad = note("c5 ~ ~ ~ ~ ~ ~ ~")
  .s("gm_crystal").velocity(.35)
  .room(.9).roomsize(10).delay(.5).delayfeedback(.7)
let pad2 = note("~ ~ ~ ~ g4 ~ ~ ~")
  .s("gm_crystal").velocity(.25)
  .room(.85).delay(.45).delayfeedback(.65)

$: arrange(
  [2, pad],
  [4, stack(pad, pad2)])`,
      },
    ],
  },
  {
    category: 'Heavy Bass',
    icon: '💥',
    examples: [
      {
        label: 'Sub Destroyer',
        code: `// sub bass destroyer
let sub = note("c1*2").s("sine")
  .gain(.7).shape(.4)
  .lpf(100)

$: arrange([4, sub])`,
      },
      {
        label: 'Wobble Monster',
        code: `// massive wobble bass
let bass = note("c1").s("sawtooth")
  .gain(.55)
  .lpf(sine.range(100,3000).fast(4))
  .lpq(12).shape(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'Reese Heavyweight',
        code: `// heavyweight reese
let bass = note("<c1 c1 e1 f1>")
  .s("sawtooth").gain(.5)
  .detune(20).lpf(400)
  .shape(.4)

$: arrange([4, bass])`,
      },
      {
        label: 'Distorted Sub',
        code: `// distorted sub bass
let sub = note("<c1 e1 f1 g1>")
  .s("sine").gain(.6)
  .shape(.6).lpf(200)

$: arrange([4, sub])`,
      },
      {
        label: '808 Long',
        code: `// long 808 bass
let sub = note("c1 ~ ~ ~ e1 ~ ~ ~")
  .s("sine").gain(.65)
  .decay(1.5).lpf(180)
  .shape(.3)

$: arrange([4, sub])`,
      },
      {
        label: 'Growl Bass',
        code: `// growling bass
let bass = note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,1500).fast(8))
  .lpq(15).shape(.35)

$: arrange([4, bass])`,
      },
      {
        label: 'Foghorn',
        code: `// foghorn sub
let bass = note("c1").s("sawtooth")
  .gain(.5).shape(.5)
  .lpf(200).lpq(4)

$: arrange([4, bass])`,
      },
      {
        label: 'Earthquake',
        code: `// earthquake rumble
let sub = note("c0*2").s("sine")
  .gain(.6).shape(.4)
  .lpf(80)

$: arrange([4, sub])`,
      },
      {
        label: 'Dirty Square',
        code: `// dirty square bass
let bass = note("c1 ~ c1 e1 ~ e1 f1 ~")
  .s("square").gain(.5)
  .shape(.4).lpf(300)

$: arrange([4, bass])`,
      },
      {
        label: 'DnB Tear',
        code: `// tearing DnB bass
let bass = note("[c1 ~] [~ g1] [e1 ~] [~ c1]")
  .s("sawtooth").gain(.55)
  .lpf(1000).shape(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'Dubstep Wub',
        code: `// dubstep wub wub
let bass = note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,2500).fast(6))
  .lpq(10).shape(.35)

$: arrange([4, bass])`,
      },
      {
        label: 'Brostep',
        code: `// brostep screech bass
let bass = note("c1*4").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,4000).fast(8))
  .lpq(15).shape(.3).crush(10)

$: arrange([4, bass])`,
      },
      {
        label: 'Wall of Bass',
        code: `// wall of sub bass
let bass = note("[c1,g1]").s("sawtooth")
  .gain(.45).shape(.5)
  .lpf(300)

$: arrange([4, bass])`,
      },
      {
        label: 'Filtered Rumble',
        code: `// filtered bass rumble
let sub = note("c1*4").s("sine")
  .gain("[.4 .6 .5 .7]")
  .shape(.4).lpf(sine.range(60,200).slow(4))

$: arrange([4, sub])`,
      },
      {
        label: 'Neuro Bass',
        code: `// neuro bass
let bass = note("c1 c1 [c1 e1] c1")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .shape(.3).crush(12)

$: arrange([4, bass])`,
      },
      {
        label: 'Phat 5ths',
        code: `// phat fifth bass
let bass = note("<[c1,g1] [e1,b1] [f1,c2] [g1,d2]>")
  .s("sawtooth").gain(.45)
  .shape(.35).lpf(500)

$: arrange([4, bass])`,
      },
      {
        label: 'Aggressive Saw',
        code: `// aggressive saw bass
let bass = note("c1 ~ c1 c1 ~ c1 e1 ~")
  .s("sawtooth").gain(.5)
  .shape(.45).lpf(600)
  .decay(.1)

$: arrange([4, bass])`,
      },
      {
        label: 'Chest Thump',
        code: `// chest-thumping sub
let sub = note("c1*4").s("sine")
  .gain(.65).shape(.5)
  .lpf(80).decay(.4)

$: arrange([4, sub])`,
      },
      {
        label: 'Trap Sub',
        code: `// deep trap 808 sub
let sub = note("c1 ~ ~ ~ ~ ~ e1 ~")
  .s("sine").gain(.6)
  .decay(1.2).shape(.3)
  .lpf(150)

$: arrange([4, sub])`,
      },
      {
        label: 'Riddim Bass',
        code: `// riddim dubstep bass
let bass = note("c1*4").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,1800).fast(2))
  .lpq(12).shape(.4)

$: arrange([4, bass])`,
      },
      {
        label: 'Detuned Terror',
        code: `// detuned terror bass
let bass = note("c1").s("sawtooth")
  .gain(.45).detune(25)
  .shape(.45).lpf(400)

$: arrange([4, bass])`,
      },
      {
        label: 'Layered Low',
        code: `// layered low-end
let sub = note("<c1 e1 f1 g1>").s("sine")
  .gain(.55).shape(.35).lpf(120)
let bass = note("<c2 e2 f2 g2>").s("sawtooth")
  .gain(.3).lpf(600).shape(.2)

$: arrange(
  [2, sub],
  [4, stack(sub, bass)])`,
      },
      {
        label: 'Punchy Low',
        code: `// punchy sub hit
let sub = note("c1 ~ ~ c1 ~ ~ c1 c1")
  .s("sine").gain(.6)
  .decay(.15).shape(.5)
  .lpf(100)

$: arrange([4, sub])`,
      },
      {
        label: 'Acid Scream',
        code: `// acid scream bass
let bass = note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,5000).fast(2))
  .lpq(18).shape(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'FM Heavy',
        code: `// FM modulated heavy bass
let sub = note("<c1 e1 f1 g1>")
  .s("sine").gain(.5)
  .fmi(3).fmh(1)
  .shape(.3).lpf(300)

$: arrange([4, sub])`,
      },
      {
        label: 'Sine Pressure',
        code: `// sine bass pressure
let sub = note("c1").s("sine")
  .gain(sine.range(.3,.7).slow(4))
  .shape(.4).lpf(100)

$: arrange([4, sub])`,
      },
      {
        label: 'Flutter Bass',
        code: `// fluttering bass
let bass = note("c1*8").s("sawtooth")
  .gain("[.3 .5]*4")
  .lpf(sine.range(200,1000).fast(4))
  .shape(.3)

$: arrange([4, bass])`,
      },
      {
        label: 'Thunder Sub',
        code: `// thunderous sub drop
let sub = note("g1 ~ ~ ~ c1 ~ ~ ~")
  .s("sine").gain(.65)
  .decay(1).shape(.45)
  .lpf(120)

$: arrange([4, sub])`,
      },
      {
        label: 'Stacked Saws',
        code: `// triple stacked saws
let bass = note("c1").s("sawtooth")
  .gain(.35).detune(10).lpf(500)
let bass2 = note("c1").s("sawtooth")
  .gain(.35).detune(-10).lpf(500)
let sub = note("c1").s("sine").gain(.4).lpf(100)

$: arrange(
  [2, bass],
  [2, stack(bass, bass2)],
  [4, stack(bass, bass2, sub)])`,
      },
      {
        label: 'Bass Drop',
        code: `// bass drop effect
let lead = note("c3 c2 c1 c1")
  .s("sine").gain(.6)
  .shape(.4).lpf(200)
  .decay(.5)

$: arrange([4, lead])`,
      },
      {
        label: 'Seismic Sub',
        code: `// seismic sub bass rumble
let sub = note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine")
  .gain(.7).lpf(80).shape(.3)
let bass = note("c1 ~ c1 ~ e1 ~ c1 ~").s("triangle")
  .gain(.3).lpf(120)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.6)

$: arrange(
  [2, sub],
  [2, stack(sub, bass)],
  [4, stack(sub, bass, kick)])`,
      },
      {
        label: 'Distorted Reese',
        code: `// distorted reese bass
let bass = note("c1 ~ ~ c1 ~ e1 ~ ~").s("sawtooth")
  .gain(.5).lpf(sine.range(100,800).slow(4)).shape(.5)
let bass2 = note("c1 ~ ~ c1 ~ e1 ~ ~").s("sawtooth")
  .gain(.45).detune(15).lpf(sine.range(120,700).slow(4)).shape(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.55)

$: arrange(
  [2, bass],
  [2, stack(bass, bass2)],
  [4, stack(bass, bass2, drums)])`,
      },
      {
        label: 'Massive 808 Slide',
        code: `// massive 808 bass slide
let sub = note("c1 ~ ~ ~ e1 ~ c1 ~").s("sine")
  .gain(.65).shape(.35).lpf(150).decay(.8)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.6)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, sub],
  [2, stack(sub, kick)],
  [4, stack(sub, kick, hats)])`,
      },
      {
        label: 'Filthy Wobble',
        code: `// filthy wobble bass
let bass = note("c1 ~ c1 ~ c1 ~ c1 ~").s("sawtooth")
  .lpf(sine.range(80,2000).fast(2)).gain(.55).shape(.4)
let sub = note("c1").s("sine").gain(.3).lpf(60)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.55)

$: arrange(
  [2, bass],
  [2, stack(bass, sub)],
  [4, stack(bass, sub, drums)])`,
      },
      {
        label: 'Acid Screech',
        code: `// acid screech bass
let bass = note("c2 c2 e2 c2 f2 c2 e2 c2")
  .s("sawtooth").lpf(sine.range(200,4000).fast(4))
  .gain(.45).shape(.3).resonance(15)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.55)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)

$: arrange(
  [2, bass],
  [2, stack(bass, kick)],
  [4, stack(bass, kick, hats)])`,
      },
      {
        label: 'Growl Bass',
        code: `// growl bass texture
let bass = note("c1 ~ e1 ~ f1 ~ e1 ~").s("sawtooth")
  .lpf(sine.range(150,1200).fast(3)).gain(.5).shape(.45)
let bass2 = note("c1 ~ e1 ~ f1 ~ e1 ~").s("square")
  .lpf(400).gain(.25)
let drums = s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.5)

$: arrange(
  [2, bass],
  [2, stack(bass, bass2)],
  [4, stack(bass, bass2, drums)])`,
      },
      {
        label: 'Earthquake Sub',
        code: `// earthquake sub bass
let sub = note("c1*2").s("sine").gain(.7).lpf(60).shape(.25)
let bass = note("c1*2").s("triangle").gain(.35).lpf(90)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.6)
let snare = s("~ ~ ~ ~ ~ ~ ~ sd").bank("RolandTR808").gain(.4)

$: arrange(
  [2, stack(sub, bass)],
  [2, stack(sub, bass, kick)],
  [4, stack(sub, bass, kick, snare)])`,
      },
      {
        label: 'Dubstep Tear',
        code: `// dubstep tear-out bass
let bass = note("c1 ~ c1 e1 ~ c1 f1 ~").s("sawtooth")
  .lpf(sine.range(100,3000).fast(8)).gain(.5).shape(.5)
let drums = s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.6)
let hats = s("~ hh ~ hh ~ hh ~ oh").bank("RolandTR909").gain(.3)

$: arrange(
  [2, bass],
  [2, stack(bass, drums)],
  [4, stack(bass, drums, hats)])`,
      },
      {
        label: 'Analog Warmth',
        code: `// warm analog bass
let bass = note("c2 ~ g1 ~ c2 ~ e2 ~").s("sawtooth")
  .lpf(600).gain(.45).shape(.2).room(.15)
let sub = note("c2 ~ g1 ~ c2 ~ e2 ~").s("sine")
  .gain(.3).lpf(200)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)

$: arrange(
  [2, bass],
  [2, stack(bass, sub)],
  [4, stack(bass, sub, drums)])`,
      },
      {
        label: 'Neurofunk Bass',
        code: `// neurofunk bass patch
let bass = note("c1 ~ c1 c1 ~ ~ c1 ~").s("sawtooth")
  .lpf(sine.range(200,2500).fast(6)).gain(.5).shape(.45)
let bass2 = note("c1 ~ c1 c1 ~ ~ c1 ~").s("square")
  .lpf(sine.range(300,1800).fast(6)).gain(.3).shape(.3)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.55)

$: arrange(
  [2, bass],
  [2, stack(bass, bass2)],
  [4, stack(bass, bass2, drums)])`,
      },
      {
        label: 'Trap Low End',
        code: `// trap heavy low end
let sub = note("c1 ~ ~ ~ ~ ~ c1 ~").s("sine")
  .gain(.65).shape(.3).lpf(100).decay(.6)
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
let hats = s("hh hh hh hh oh hh hh hh").bank("RolandTR808").gain(.3)
let snare = s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, stack(sub, kick)],
  [2, stack(sub, kick, hats)],
  [4, stack(sub, kick, hats, snare)])`,
      },
      {
        label: 'FM Bass Buzz',
        code: `// fm bass buzz
let sub = note("c1 ~ e1 ~ c1 ~ f1 ~").s("sine")
  .gain(.5).shape(.5).lpf(300)
let bass = note("c2 ~ e2 ~ c2 ~ f2 ~").s("square")
  .gain(.25).lpf(500)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, sub],
  [2, stack(sub, bass)],
  [4, stack(sub, bass, drums)])`,
      },
      {
        label: 'Garage Bass Thump',
        code: `// garage heavy bass thump
let sub = note("c2 ~ ~ c2 ~ ~ e2 ~").s("sine")
  .gain(.6).shape(.3).lpf(150)
let drums = s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR808").gain(.3)
let clap = s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.35)

$: arrange(
  [2, stack(sub, drums)],
  [2, stack(sub, drums, hats)],
  [4, stack(sub, drums, hats, clap)])`,
      },
      {
        label: 'Distortion Chain',
        code: `// distortion chain bass
let bass = note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth")
  .gain(.45).shape(.6).lpf(400)
let bass2 = note("c1 ~ c1 ~ ~ ~ c1 ~").s("triangle")
  .gain(.35).shape(.4).lpf(250)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)

$: arrange(
  [2, bass],
  [2, stack(bass, bass2)],
  [4, stack(bass, bass2, drums)])`,
      },
      {
        label: 'Phaser Bass',
        code: `// phaser bass sweep
let bass = note("c1 e1 c1 f1 c1 e1 c1 g1")
  .s("sawtooth").lpf(sine.range(200,1500).slow(2))
  .gain(.45).shape(.3)
let sub = note("c1 e1 c1 f1 c1 e1 c1 g1")
  .s("sine").gain(.3).lpf(100)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)

$: arrange(
  [2, bass],
  [2, stack(bass, sub)],
  [4, stack(bass, sub, drums)])`,
      },
      {
        label: 'Square Pulse Bass',
        code: `// square pulse bass
let bass = note("c1 ~ c1 ~ e1 ~ c1 ~").s("square")
  .gain(.5).lpf(300).shape(.35)
let drums = s("bd bd ~ ~ sd ~ bd ~").bank("RolandTR909").gain(.5)
let hats = s("hh hh hh hh hh oh hh hh").bank("RolandTR909").gain(.25)

$: arrange(
  [2, bass],
  [2, stack(bass, drums)],
  [4, stack(bass, drums, hats)])`,
      },
      {
        label: 'Stacked Octave Bass',
        code: `// stacked octave bass
let sub = note("c1 ~ e1 ~ f1 ~ e1 ~").s("sine").gain(.55).lpf(80)
let bass = note("c2 ~ e2 ~ f2 ~ e2 ~").s("sawtooth").gain(.3).lpf(500).shape(.3)
let synth = note("c3 ~ e3 ~ f3 ~ e3 ~").s("square").gain(.15).lpf(1000)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, stack(sub, bass)],
  [2, stack(sub, bass, synth)],
  [4, stack(sub, bass, synth, drums)])`,
      },
      {
        label: 'Detuned Fatness',
        code: `// detuned fat bass
let bass = note("c1 ~ c1 ~ e1 ~ c1 ~").s("sawtooth")
  .gain(.4).detune(20).lpf(400).shape(.3)
let bass2 = note("c1 ~ c1 ~ e1 ~ c1 ~").s("sawtooth")
  .gain(.4).detune(-20).lpf(400).shape(.3)
let sub = note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine").gain(.3).lpf(80)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)

$: arrange(
  [2, stack(bass, bass2)],
  [2, stack(bass, bass2, sub)],
  [4, stack(bass, bass2, sub, drums)])`,
      },
      {
        label: 'Thunderous Kick Bass',
        code: `// thunderous kick-bass combo
let sub = note("c1 ~ ~ ~ c1 ~ ~ ~").s("sine")
  .gain(.7).shape(.4).lpf(70).decay(.4)
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.65)
let snare = s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(.5)
let hats = s("hh hh hh hh oh hh hh hh").bank("RolandTR808").gain(.25)

$: arrange(
  [2, stack(sub, kick)],
  [2, stack(sub, kick, snare)],
  [4, stack(sub, kick, snare, hats)])`,
      },
    ],
  },
  {
    category: 'Loopers',
    icon: '🔁',
    examples: [
      {
        label: 'Loop Layer 1',
        code: `// basic loop layer
let drums = s("bd sd [~ bd] sd")
  .bank("RolandTR808").gain(.75)

$: arrange([4, drums])`,
      },
      {
        label: 'Loop Layer 2',
        code: `// add hi-hats to loop
let hats = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .6]")

$: arrange([4, hats])`,
      },
      {
        label: 'Loop Bass',
        code: `// bass loop layer
let sub = note("<c2 c2 f2 g2>")
  .s("sine").gain(.5)
  .lpf(200).shape(.15)

$: arrange([4, sub])`,
      },
      {
        label: 'Loop Chord',
        code: `// chord loop layer
let pad = note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.3).slow(2)

$: arrange([4, pad])`,
      },
      {
        label: 'Loop Melody',
        code: `// melody loop layer
let piano = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.5)

$: arrange([4, piano])`,
      },
      {
        label: 'Stacking Beats',
        code: `// stack beats together
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.6)
let hats = s("[~ hh]*4").gain(.4)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Slow Build',
        code: `// slow build loop
let kick = s("bd ~ ~ ~").gain(.7)
let rim = s("~ ~ ~ rim").gain(.25)

$: arrange(
  [2, kick],
  [4, stack(kick, rim)])`,
      },
      {
        label: 'Add Perc',
        code: `// add percussion layer
let rim = s("rim(5,8)").gain(.3)
let openHat = s("oh(2,8)").gain(.25).room(.3)

$: arrange(
  [2, rim],
  [4, stack(rim, openHat)])`,
      },
      {
        label: 'Pad Layer',
        code: `// pad background layer
let pad = note("<[c3,g3,c4]>")
  .s("sine").gain(.25)
  .room(.6).roomsize(4).slow(4)

$: arrange([4, pad])`,
      },
      {
        label: 'FX Layer',
        code: `// FX texture layer
let hats = s("hh*16").gain("[.05 .1]*8")
  .lpf(sine.range(500,3000).slow(8))
  .room(.4)

$: arrange([4, hats])`,
      },
      {
        label: '2-Bar Loop',
        code: `// 2-bar repeating loop
let drums = s("bd sd [~ bd] sd bd [~ sd] bd sd")
  .bank("RolandTR808").gain(.75)

$: arrange([4, drums])`,
      },
      {
        label: '4-Bar Melody',
        code: `// 4-bar melody loop
let piano = note("<c4 e4 g4 b4 c5 b4 g4 f4 e4 c4 b3 c4 e4 g4 b4 c5>")
  .s("piano").gain(.5).slow(2)

$: arrange([4, piano])`,
      },
      {
        label: 'Polyrhythm Loop',
        code: `// polyrhythm loop layers
let kick = s("bd(3,8)").gain(.75)
let clap = s("cp(5,8)").gain(.5)
let hats = s("hh(7,8)").gain(.35)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, hats)])`,
      },
      {
        label: 'Ambient Loop',
        code: `// ambient loop texture
let pad = note("<[c3,g3]>").s("sine")
  .gain(.2).room(.8).roomsize(6)
let hats = s("hh*16").gain("[.03 .06]*8")
  .lpf(2000).room(.4)

$: arrange(
  [2, pad],
  [4, stack(pad, hats)])`,
      },
      {
        label: 'Vocal Loop',
        code: `// vocal chop loop
let vox = s("chin:0 ~ chin:1 ~")
  .gain(.5).room(.3)
  .speed("<1 1.2 .8 1>")

$: arrange([4, vox])`,
      },
      {
        label: 'Bass + Drums Loop',
        code: `// bass and drums loop
let kick = s("bd*4").bank("RolandTR909").gain(.85)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.6)
let sub = note("c2 c2 c2 c2")
  .s("sine").gain(.5).lpf(200)

$: arrange(
  [2, kick],
  [2, stack(kick, clap)],
  [4, stack(kick, clap, sub)])`,
      },
      {
        label: 'Guitar Loop',
        code: `// guitar riff loop
let guitar = note("c3 e3 g3 c4 g3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)

$: arrange([4, guitar])`,
      },
      {
        label: 'Rhodes Loop',
        code: `// rhodes chord loop
let keys = note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)

$: arrange([4, keys])`,
      },
      {
        label: 'Minimal Loop',
        code: `// minimal techno loop
let kick = s("bd*4").gain(.8)
let rim = s("~ rim ~ ~").gain(.3)
let hats = s("hh*16").gain("[.15 .3]*8")

$: arrange(
  [2, kick],
  [2, stack(kick, rim)],
  [4, stack(kick, rim, hats)])`,
      },
      {
        label: 'Breakbeat Loop',
        code: `// breakbeat loop
let kick = s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
let snare = s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)

$: arrange(
  [2, kick],
  [4, stack(kick, snare)])`,
      },
      {
        label: 'Dub Loop',
        code: `// dub reggae loop
let kick = s("bd ~ ~ bd ~ ~ bd ~").gain(.7)
let clap = s("~ ~ cp ~ ~ ~ ~ ~").gain(.5)
  .delay(.4).delayfeedback(.5)

$: arrange(
  [2, kick],
  [4, stack(kick, clap)])`,
      },
      {
        label: 'Triplet Loop',
        code: `// triplet feel loop
let kick = s("bd(3,12)").gain(.75)
let snare = s("sd(4,12,1)").gain(.55)
let hats = s("hh*12").gain("[.2 .3 .25]*4")

$: arrange(
  [2, kick],
  [2, stack(kick, snare)],
  [4, stack(kick, snare, hats)])`,
      },
      {
        label: 'Evolving Loop',
        code: `// slowly evolving loop
let synth = note("<c3 c3 e3 g3>")
  .s("sawtooth").gain(.35)
  .lpf(sine.range(400,2000).slow(16))
  .room(.3)

$: arrange([4, synth])`,
      },
      {
        label: 'Stack All',
        code: `// full stack loop
let kick = s("bd*4").gain(.8)
let clap = s("~ cp ~ ~").gain(.6)
let hats = s("[~ hh]*4").gain(.4)
let sub = note("<c2 f2 g2 b1>").s("sine").gain(.5).lpf(200)
let pad = note("<[c3,e3,g3]>").s("supersaw").gain(.25).lpf(1500)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, sub)],
  [4, stack(kick, clap, hats, sub, pad)])`,
      },
      {
        label: 'Chop Loop',
        code: `// chopped loop effect
let piano = note("c3 e3 g3 b3")
  .s("piano").gain(.5)
  .chop(4)

$: arrange([4, piano])`,
      },
      {
        label: 'Reverse Loop',
        code: `// reverse layer
let vox = s("chin:0 chin:1")
  .speed(-1).gain(.4)
  .room(.5).delay(.3).slow(2)

$: arrange([4, vox])`,
      },
      {
        label: 'Drone Loop',
        code: `// drone base loop
let bass = note("[c2,g2]").s("sawtooth")
  .gain(.2).lpf(400)
  .room(.7).roomsize(5)

$: arrange([4, bass])`,
      },
      {
        label: 'Glitch Loop',
        code: `// glitch pattern loop
let kick = s("bd").chop(16)
  .speed(perlin.range(.5,2))
  .gain(.5)

$: arrange([4, kick])`,
      },
      {
        label: 'Layer + Filter',
        code: `// loop with filter sweep
let drums = s("bd sd [~ bd] sd")
  .bank("RolandTR808").gain(.7)
let synth = note("c3*4").s("sawtooth")
  .gain(.3).lpf(sine.range(300,2000).slow(8))

$: arrange(
  [2, drums],
  [4, stack(drums, synth)])`,
      },
      {
        label: 'Complete Stack',
        code: `// complete loop stack
let drums = s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
let hats = s("[~ hh]*4").bank("RolandTR808").gain(.3)
let sub = note("<c2 a1 b1 g1>").s("sine").gain(.5).lpf(200).slow(2)
let keys = note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>").s("piano").gain(.45).room(.4).slow(2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, sub)],
  [4, stack(drums, hats, sub, keys)])`,
      },
      {
        label: 'Minimal Loop Build',
        code: `// minimal loop building blocks
let kick = s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.55)
let snare = s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(.45)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)
let sub = note("c2 ~ c2 ~ e2 ~ c2 ~").s("sine").gain(.4).lpf(100)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, sub)])`,
      },
      {
        label: 'Groove Layer Stack',
        code: `// layered groove stack
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.55)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)
let bass = note("c2 ~ e2 ~ f2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.5)
let keys = note("<[c3,e3,g3] [b2,d3,f3]>").s("gm_epiano1").velocity(.3).slow(2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, keys)])`,
      },
      {
        label: 'Ambient Loop',
        code: `// ambient loop layers
let pad = note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [g3,b3,d3]>")
  .s("gm_warm_pad").velocity(.3).room(.7).slow(4)
let bells = note("c5 ~ e5 ~ g5 ~ ~ ~").s("gm_celesta").velocity(.2).delay(.3)
let kick = s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.3).room(.4)

$: arrange(
  [2, pad],
  [2, stack(pad, bells)],
  [4, stack(pad, bells, kick)])`,
      },
      {
        label: 'Funk Loop Kit',
        code: `// funk loop kit
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)
let bass = note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.55)
let guitar = note("~ [e4,g4] ~ ~ ~ [f4,a4] ~ ~").s("gm_clean_guitar").velocity(.35)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, guitar)])`,
      },
      {
        label: 'Techno Loop Stack',
        code: `// techno loop stack
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.6)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.5)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)
let bass = note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth").lpf(300).gain(.45).shape(.3)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats)],
  [4, stack(kick, clap, hats, bass)])`,
      },
      {
        label: 'Lo-Fi Loop Tape',
        code: `// lo-fi tape loop
let piano = note("c4 e4 g4 b4 g4 e4 c4 ~")
  .s("gm_epiano2").velocity(.35).lpf(2000).room(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
let hats = s("hh hh hh hh").bank("RolandTR808").gain(.2)
let bass = note("c2 ~ g2 ~ c2 ~ e2 ~").s("gm_acoustic_bass").velocity(.35)

$: arrange(
  [2, stack(piano, drums)],
  [2, stack(piano, drums, hats)],
  [4, stack(piano, drums, hats, bass)])`,
      },
      {
        label: 'DnB Loop Build',
        code: `// drum and bass loop build
let drums = s("bd ~ sd ~ ~ bd sd ~, ~ ~ ~ bd ~ ~ sd ~")
  .bank("RolandTR909").gain(.55)
let hats = s("hh hh hh hh oh hh hh hh").bank("RolandTR909").gain(.3)
let bass = note("c2 ~ ~ c2 e2 ~ c2 ~").s("gm_synth_bass_1").velocity(.55)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, bass)])`,
      },
      {
        label: 'Jazz Loop Cycle',
        code: `// jazz loop cycle
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.4)
let hats = s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.25)
let bass = note("d2 a2 g2 d3 c2 g2 f2 c3").s("gm_acoustic_bass").velocity(.45)
let keys = note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.3).slow(2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, keys)])`,
      },
      {
        label: 'Reggae Loop',
        code: `// reggae loop layers
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
let rim = s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)
let bass = note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
let guitar = note("~ [b3,d4,f4] ~ [b3,d4,f4] ~ [a3,c4,e4] ~ [a3,c4,e4]")
  .s("gm_muted_guitar").velocity(.35)

$: arrange(
  [2, stack(drums, rim)],
  [2, stack(drums, rim, bass)],
  [4, stack(drums, rim, bass, guitar)])`,
      },
      {
        label: 'House Loop Full',
        code: `// full house loop
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.55)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.45)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)
let bass = note("c2 ~ c2 ~ e2 ~ c2 ~").s("gm_synth_bass_2").velocity(.5)
let keys = note("<[c3,e3,g3]>").s("gm_epiano2").velocity(.25).slow(4)

$: arrange(
  [2, stack(kick, clap)],
  [2, stack(kick, clap, hats, bass)],
  [4, stack(kick, clap, hats, bass, keys)])`,
      },
      {
        label: 'Latin Loop Stack',
        code: `// latin loop stack
let drums = s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)
let bass = note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.5)
let brass = note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_trumpet").velocity(.35).room(.3)

$: arrange(
  [2, stack(drums, rim)],
  [2, stack(drums, rim, bass)],
  [4, stack(drums, rim, bass, brass)])`,
      },
      {
        label: 'R&B Loop Smooth',
        code: `// smooth R&B loop
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.25)
let bass = note("c2 ~ e2 ~ f2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.45)
let keys = note("<[c4,e4,g4,b4] [f3,a3,c4,e4]>")
  .s("gm_epiano2").velocity(.3).room(.35).slow(2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, keys)])`,
      },
      {
        label: 'Cinematic Loop',
        code: `// cinematic loop layers
let strings = note("<[c3,g3,c4] [a2,e3,a3] [b2,f3,b3] [g2,d3,g3]>")
  .s("gm_strings1").velocity(.4).room(.6).slow(4)
let kick = s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.4).room(.4)
let flute = note("c5 ~ e5 ~ g5 ~ ~ ~").s("gm_flute").velocity(.25).room(.5)
let bass = note("c2 ~ ~ ~ a1 ~ ~ ~").s("gm_contrabass").velocity(.35).slow(2)

$: arrange(
  [2, stack(strings, kick)],
  [2, stack(strings, kick, flute)],
  [4, stack(strings, kick, flute, bass)])`,
      },
      {
        label: 'Trap Loop Kit',
        code: `// trap loop kit
let kick = s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
let snare = s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR808").gain(.5)
let hats = s("hh hh hh hh oh hh [hh hh] hh").bank("RolandTR808").gain(.3)
let sub = note("c1 ~ ~ ~ ~ ~ c1 ~").s("sine").gain(.55).shape(.3).lpf(80)

$: arrange(
  [2, stack(kick, snare)],
  [2, stack(kick, snare, hats)],
  [4, stack(kick, snare, hats, sub)])`,
      },
      {
        label: 'Gospel Loop',
        code: `// gospel loop stack
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.4)
let organ = note("[c3,e3,g3,c4] ~ [d3,f3,a3,d4] ~ [e3,g3,b3,e4] ~ [c3,e3,g3,c4] ~")
  .s("gm_church_organ").velocity(.4).room(.5).slow(2)
let bass = note("c2 d2 e2 c2 d2 e2 g2 c2").s("gm_acoustic_bass").velocity(.4)

$: arrange(
  [2, stack(drums, clap)],
  [2, stack(drums, clap, organ)],
  [4, stack(drums, clap, organ, bass)])`,
      },
      {
        label: 'Garage Loop',
        code: `// 2-step garage loop
let drums = s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)
let hats = s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR808").gain(.3)
let bass = note("c2 ~ ~ c2 ~ ~ e2 ~").s("gm_synth_bass_1").velocity(.5)
let oohs = note("<[c3,e3,g3]>").s("gm_voice_oohs").velocity(.2).room(.4).slow(4)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, oohs)])`,
      },
      {
        label: 'Afro Loop Stack',
        code: `// afrobeat loop stack
let drums = s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)
let bass = note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_electric_bass_finger").velocity(.5)
let brass = note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_trumpet").velocity(.3).room(.3)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, brass)])`,
      },
      {
        label: 'Synthwave Loop',
        code: `// synthwave loop full
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.25)
let bass = note("c2 ~ c2 ~ g1 ~ c2 ~").s("gm_synth_bass_2").velocity(.5)
let pad = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("sawtooth").lpf(2000).gain(.2).room(.35).slow(2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass)],
  [4, stack(drums, hats, bass, pad)])`,
      },
      {
        label: 'Progressive Loop',
        code: `// progressive build loop
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR909").gain(.3)
let bass = note("c2 ~ c2 ~ e2 ~ f2 ~").s("gm_synth_bass_1").velocity(.5)
let pad = note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [b3,d4,f4]>")
  .s("gm_warm_pad").velocity(.3).room(.5).slow(4)
let lead = note("c5 e5 g5 ~ ~ ~ ~ ~").s("gm_saw_lead").gain(.15).delay(.2)

$: arrange(
  [2, stack(drums, hats)],
  [2, stack(drums, hats, bass, pad)],
  [4, stack(drums, hats, bass, pad, lead)])`,
      },
    ],
  },
  {
    category: 'Male Vocals',
    icon: '🧔',
    examples: [
      {
        label: 'Deep Choir',
        code: `// deep male choir
let choir = note("<[c2,g2,c3] [a1,e2,a2]>")
  .s("gm_choir_aahs").velocity(.4)
  .lpf(800).room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Low Hum',
        code: `// low humming bass tone
let choir = note("<c2 d2 e2 d2>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(500).room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Baritone Melody',
        code: `// baritone singing line
let choir = note("c3 d3 e3 f3 g3 f3 e3 d3")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4)

$: arrange([4, choir])`,
      },
      {
        label: 'Drone Bass Voice',
        code: `// droning bass vocal
let choir = note("[c2,g2]")
  .s("gm_choir_aahs").velocity(.35)
  .room(.7).roomsize(5)
  .lpf(600)

$: arrange([4, choir])`,
      },
      {
        label: 'Chant Low',
        code: `// low chant pattern
let choir = note("c2 ~ e2 ~ g2 ~ e2 ~")
  .s("gm_choir_aahs").velocity(.35)
  .lpf(700).room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Tenor Harmony',
        code: `// tenor vocal harmony
let choir = note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Reverb Wash',
        code: `// male vocal reverb wash
let choir = note("<[c2,g2,c3]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.9).roomsize(8).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Deep Echo',
        code: `// deep male vocal echo
let choir = note("c2 ~ ~ e2 ~ ~ g2 ~")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.5).delayfeedback(.6)
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Vowel',
        code: `// male vowel morph
let synth = note("c3*4").s("sawtooth")
  .gain(.3).vowel("<a e i o>")
  .lpf(1200)

$: arrange([4, synth])`,
      },
      {
        label: 'Low Pad',
        code: `// low male pad
let choir = note("<[c2,e2,g2] [a1,c2,e2]>")
  .s("gm_choir_aahs").velocity(.3)
  .room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Bass Swell',
        code: `// bass vocal swell
let choir = note("<[c2,g2]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.1,.4).slow(4))
  .room(.6).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Staccato',
        code: `// staccato male voice
let choir = note("c3 ~ c3 ~ e3 ~ c3 ~")
  .s("gm_choir_aahs").velocity(.4)
  .decay(.15).lpf(1000)

$: arrange([4, choir])`,
      },
      {
        label: 'Deep Harmony Stack',
        code: `// stacked deep harmony
let choir = note("<[c2,g2,c3] [b1,f2,b2]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Delayed',
        code: `// delayed male vocal
let choir = note("c2 ~ ~ ~ e2 ~ ~ ~")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.6).delayfeedback(.65)
  .room(.4)

$: arrange([4, choir])`,
      },
      {
        label: 'Gregorian Chant',
        code: `// gregorian chant style
let choir = note("c3 d3 c3 b2 c3 d3 e3 d3")
  .s("gm_choir_aahs").velocity(.35)
  .room(.8).roomsize(6).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Octaves',
        code: `// male octave drone
let choir = note("[c2,c3]")
  .s("gm_choir_aahs").velocity(.35)
  .room(.6).roomsize(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Numbers Count',
        code: `// numbers vocal beat
let numbers = s("numbers:0 numbers:1 numbers:2 numbers:3")
  .gain(.5).speed(1.1)

$: arrange([4, numbers])`,
      },
      {
        label: 'East Chant Male',
        code: `// eastern male chant
let east = s("east:0 east:2 east:3 east:6")
  .gain(.5).room(.4).slow(2)

$: arrange([4, east])`,
      },
      {
        label: 'Chin Chop',
        code: `// chin vocal chop
let vox = s("chin:0 chin:2 chin:1 chin:3")
  .gain(.5).room(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Low Filtered Voice',
        code: `// filtered low voice
let choir = note("<c2 d2 e2 c2>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(sine.range(300,800).slow(4))
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Whisper',
        code: `// whisper-like texture
let breath = s("breath:0 ~ breath:1 ~")
  .gain(.3).lpf(1500)
  .room(.6).roomsize(4).slow(2)

$: arrange([4, breath])`,
      },
      {
        label: 'Deep Sustain',
        code: `// deep sustained voice
let choir = note("c2").s("gm_choir_aahs")
  .velocity(.35).room(.7).roomsize(5)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Chopped',
        code: `// chopped male choir
let choir = note("[c2,g2,c3]")
  .s("gm_choir_aahs").velocity(.35)
  .chop(8).room(.3)

$: arrange([4, choir])`,
      },
      {
        label: 'Crushed Voice',
        code: `// crushed male vocal
let vox = s("chin:0 chin:2").gain(.5)
  .crush(8).room(.3).slow(2)

$: arrange([4, vox])`,
      },
      {
        label: 'Low Reverb Hits',
        code: `// reverb male hits
let choir = note("c2 ~ ~ ~ g2 ~ ~ ~")
  .s("gm_choir_aahs").velocity(.4)
  .room(.85).roomsize(7)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Pulse',
        code: `// pulsing male voice
let choir = note("c2*4").s("gm_choir_aahs")
  .velocity("[.15 .35 .25 .4]")
  .room(.4)

$: arrange([4, choir])`,
      },
      {
        label: 'Baritone Pad',
        code: `// baritone pad wash
let choir = note("<[c2,e2,g2,b2]>")
  .s("gm_choir_aahs").velocity(.3)
  .room(.7).roomsize(5).slow(4)

$: arrange([4, choir])`,
      },
      {
        label: 'Male + Beat',
        code: `// male choir over beat
let drums = s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
let hats = s("[~ hh]*4").bank("RolandTR808").gain(.3)
let choir = note("<[c2,g2,c3]>").s("gm_choir_aahs")
  .velocity(.3).room(.4).slow(2)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, choir)])`,
      },
      {
        label: 'Deep Swell',
        code: `// deep male swell
let choir = note("<[c2,g2]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.1,.45).slow(8))
  .room(.7).roomsize(5)

$: arrange([4, choir])`,
      },
      {
        label: 'Male Harmony Full',
        code: `// full male harmony
let choir = note("<[c2,e2,g2] [a1,c2,e2] [f1,a1,c2] [g1,b1,d2]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.5).slow(2)

$: arrange([4, choir])`,
      },
      {
        label: 'Male R&B Smooth',
        code: `// male R&B smooth — "Velvet Nights"
// Velvet nights and city lights that fade
// Every word a promise that we made
// Shadows dance across the bedroom wall
// Whispered love before the curtains fall
// Hold me close through winter spring and all
let choir = note("c3 d3 e3 g3 f3 e3 d3 c3").s("gm_choir_aahs")
  .velocity(sine.range(.3,.55).slow(8)).room(.5)
let keys = note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.25).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.2)

$: arrange(
  [2, stack(choir, keys)],
  [2, stack(choir, keys, drums)],
  [4, stack(choir, keys, drums, hats)])`,
      },
      {
        label: 'Male Hip-Hop Deep',
        code: `// male hip-hop vocal — "Concrete Crown"
// Concrete crown upon a weary head
// Every verse is blood and tears I shed
// Streets remember every name I spoke
// Rising from the ashes and the smoke
// Legacy of fire never broke
let choir = note("c2 c2 e2 f2 e2 c2 ~ c2").s("gm_choir_aahs")
  .velocity(.5).room(.3)
let bass = note("c1 ~ c1 ~ e1 ~ f1 ~").s("gm_synth_bass_1").velocity(.6)
let drums = s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.55)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, drums)],
  [4, stack(choir, bass, drums, hats)])`,
      },
      {
        label: 'Male Jazz Croon',
        code: `// male jazz croon — "Midnight Club"
// Midnight club where saxophones confide
// Bourbon neat and music is the guide
// Velvet voice that floats above the crowd
// Singing soft but meaning something loud
// In this room the lonely ones are proud
let choir = note("g2 a2 b2 d3 c3 b2 a2 g2").s("gm_choir_aahs")
  .velocity(.4).room(.5).delay(.15)
let bass = note("g2 d3 c3 g2 f2 c3 b2 g2").s("gm_acoustic_bass").velocity(.45)
let hats = s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)

$: arrange(
  [2, choir],
  [2, stack(choir, bass)],
  [4, stack(choir, bass, hats)])`,
      },
      {
        label: 'Male Gospel Lead',
        code: `// male gospel lead — "Higher Ground"
// Higher ground is calling out my name
// Through the fire walking through the flame
// Every trial only makes me strong
// Singing praise the whole day long
// Grace will carry us where we belong
let choir = note("c3 e3 f3 g3 a3 g3 f3 e3").s("gm_choir_aahs")
  .velocity(.6).room(.6)
let organ = note("[c3,e3,g3] ~ [f3,a3,c4] ~ [g3,b3,d4] ~ [c3,e3,g3] ~")
  .s("gm_church_organ").velocity(.35).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.35)

$: arrange(
  [2, stack(choir, organ)],
  [2, stack(choir, organ, drums)],
  [4, stack(choir, organ, drums, clap)])`,
      },
      {
        label: 'Male Blues Growl',
        code: `// male blues growl — "Rusty Rails"
// Rusty rails and whiskey stained goodbyes
// Mornin' sun just burnin' through my eyes
// Woman gone and took the car and dog
// Sittin' here just sinkin' in the fog
// Blues keep rollin' like a hollow log
let choir = note("e2 g2 a2 b2 a2 g2 e2 ~").s("gm_choir_aahs")
  .velocity(sine.range(.35,.6).slow(6)).room(.4)
let guitar = note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.35)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, choir],
  [2, stack(choir, guitar)],
  [4, stack(choir, guitar, drums)])`,
      },
      {
        label: 'Male Reggae Chant',
        code: `// male reggae chant — "Island Roots"
// Island roots are deeper than the sea
// Jah provide the way for you and me
// Babylon can never break the chain
// Music wash away the hurt and pain
// Rise again like sunshine after rain
let choir = note("g2 b2 c3 d3 c3 b2 g2 ~").s("gm_choir_aahs")
  .velocity(.45).room(.5).delay(.2)
let bass = note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.45)

$: arrange(
  [2, choir],
  [2, stack(choir, bass)],
  [4, stack(choir, bass, drums)])`,
      },
      {
        label: 'Male Rock Anthem',
        code: `// male rock anthem — "Iron Will"
// Iron will and thunder in my chest
// Every scar a badge upon my vest
// Stadium is roaring feel the sound
// Feet are pounding shake the frozen ground
// We are legends and we won't be bound
let choir = note("e2 e2 g2 a2 b2 a2 g2 e2").s("gm_choir_aahs")
  .velocity(.6).room(.35)
let guitar = note("[e2,b2,e3] ~ [a2,e3,a3] ~ [d2,a2,d3] ~ [e2,b2,e3] ~")
  .s("gm_overdriven_guitar").velocity(.45).slow(2)
let bass = note("e1 ~ e1 ~ a1 ~ b1 ~").s("gm_electric_bass_pick").velocity(.5)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)

$: arrange(
  [2, stack(choir, guitar)],
  [2, stack(choir, guitar, bass)],
  [4, stack(choir, guitar, bass, drums)])`,
      },
      {
        label: 'Male Folk Tender',
        code: `// male folk tender — "Timber Creek"
// Timber creek where fireflies ignite
// Banjo strings are humming through the night
// Mama sang a lullaby so sweet
// Daddy tapped his worn out muddy feet
// Simple life that nothing can defeat
let choir = note("g2 a2 b2 d3 b2 a2 g2 g2").s("gm_choir_aahs")
  .velocity(.4).room(.45)
let guitar = note("g2 b2 d3 g3 d3 b2 g2 b2").s("gm_banjo").velocity(.35)
let bass = note("g2 ~ d2 ~ g2 ~ d2 ~").s("gm_acoustic_bass").velocity(.4)

$: arrange(
  [2, choir],
  [2, stack(choir, guitar)],
  [4, stack(choir, guitar, bass)])`,
      },
      {
        label: 'Male Soul Falsetto',
        code: `// male soul falsetto — "Purple Sky"
// Purple sky is bleeding into gold
// Stories that the universe has told
// Reaching for the notes that heal the soul
// Falsetto makes the broken pieces whole
// Love is all that fills this empty bowl
let oohs = note("c3 e3 g3 c4 g3 e3 c3 ~").s("gm_voice_oohs")
  .velocity(sine.range(.25,.5).slow(8)).room(.5)
let keys = note("[c3,e3,g3,b3] ~ [f2,a2,c3] ~")
  .s("gm_epiano1").velocity(.25).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, keys)],
  [4, stack(oohs, keys, drums)])`,
      },
      {
        label: 'Male Country Road',
        code: `// male country vocal — "Back Roads"
// Back roads and a pickup full of hay
// Radio is playin' yesterday
// Dust cloud rising like a golden veil
// Front porch stories over ginger ale
// Sundown singin' down the cotton trail
let choir = note("e2 g2 g2 a2 g2 g2 e2 d2").s("gm_choir_aahs")
  .velocity(.45).room(.4)
let guitar = note("e2 a2 b2 e2 a2 b2 e2 a2").s("gm_steel_guitar").velocity(.3)
let bass = note("e2 ~ a1 ~ b1 ~ e2 ~").s("gm_acoustic_bass").velocity(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, guitar)],
  [2, stack(choir, guitar, bass)],
  [4, stack(choir, guitar, bass, drums)])`,
      },
      {
        label: 'Male Opera Bass',
        code: `// male opera bass — "Cathedral Dawn"
// Cathedral dawn with voices carved in stone
// A single note that shakes the very bone
// The choir swells through arches high and wide
// Echoes from the altar deep inside
// Majesty that never can be denied
let choir = note("c2 ~ d2 ~ e2 ~ c2 ~").s("gm_choir_aahs")
  .velocity(.5).room(.8).roomsize(8).slow(2)
let choir2 = note("[c2,g2,c3] ~ [d2,a2,d3] ~ [e2,b2,e3] ~ [c2,g2,c3] ~")
  .s("gm_choir_aahs").velocity(.3).room(.75).slow(2)

$: arrange(
  [2, choir],
  [4, stack(choir, choir2)])`,
      },
      {
        label: 'Male Dancehall',
        code: `// male dancehall vocal — "Riddim King"
// Riddim king upon the mic tonight
// Every word I spit ignite the light
// Crowd a rock from left side to the right
// Sound system a shake with all its might
// Dancehall general ready for the fight
let choir = note("d2 f2 g2 a2 g2 f2 d2 ~").s("gm_choir_aahs")
  .velocity(.5).room(.3)
let bass = note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.55)
let drums = s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.5)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, drums)],
  [4, stack(choir, bass, drums, rim)])`,
      },
      {
        label: 'Male Afro Spirit',
        code: `// male afro spiritual — "Drum Circle"
// Drum circle beating like a heart
// Ancient rhythms since the very start
// Voices rise above the desert sand
// Unity connected hand to hand
// Music is the language of the land
let choir = note("d2 f2 g2 a2 g2 f2 d2 c2").s("gm_choir_aahs")
  .velocity(.5).room(.4).delay(.15)
let bass = note("d1 ~ d1 ~ f1 ~ g1 ~").s("gm_synth_bass_1").velocity(.5)
let drums = s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, drums)],
  [4, stack(choir, bass, drums, hats)])`,
      },
      {
        label: 'Male Pop Bright',
        code: `// male pop hook — "Electric Sky"
// Electric sky is brighter than the sun
// Dancing like tomorrow never comes
// Every heartbeat synced up to the bass
// Neon running down my smiling face
// This is our forever time and place
let choir = note("c3 d3 e3 g3 e3 d3 c3 ~").s("gm_choir_aahs")
  .velocity(.5).room(.35)
let keys = note("[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]")
  .s("gm_bright_piano").velocity(.3).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.45)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.2)

$: arrange(
  [2, stack(choir, keys)],
  [2, stack(choir, keys, drums)],
  [4, stack(choir, keys, drums, hats)])`,
      },
      {
        label: 'Male Latin Bolero',
        code: `// male latin bolero — "Rosa Eterna"
// Rosa eterna floreciendo al sol
// Cada nota llena de dolor
// Canto bajo la luna brillar
// El corazon empieza a recordar
// Musica que nunca va a parar
let choir = note("a2 b2 c3 d3 c3 a2 g2 a2").s("gm_choir_aahs")
  .velocity(.45).room(.45).delay(.1)
let bass = note("a1 ~ c2 ~ d2 ~ e2 ~").s("gm_acoustic_bass").velocity(.45)
let guitar = note("[a2,c3,e3] ~ [d3,f3,a3] ~ [e3,g3,b3] ~ [a2,c3,e3] ~")
  .s("gm_nylon_guitar").velocity(.3).slow(2)

$: arrange(
  [2, choir],
  [2, stack(choir, bass)],
  [4, stack(choir, bass, guitar)])`,
      },
      {
        label: 'Male Trap Melodic',
        code: `// male trap melodic — "Midnight Drive"
// Midnight drive the city open wide
// Every demon riding by my side
// Money talk but silence golden still
// Grinding hard on top of every hill
// Made it out by nothing but my will
let synthVox = note("c2 ~ e2 ~ f2 e2 c2 ~").s("gm_synth_voice")
  .velocity(.5).room(.25).delay(.1)
let sub = note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine").gain(.5).lpf(80).shape(.3)
let drums = s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.55)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(synthVox, sub)],
  [2, stack(synthVox, sub, drums)],
  [4, stack(synthVox, sub, drums, hats)])`,
      },
      {
        label: 'Male Indie Warm',
        code: `// male indie warm — "Paper Boats"
// Paper boats upon a puddle stream
// Chasing down the edges of a dream
// Afternoon with nothing left to prove
// Awkward hearts that find a gentle groove
// Every little gesture says I love you
let choir = note("e2 g2 a2 b2 a2 g2 e2 d2").s("gm_choir_aahs")
  .velocity(.4).room(.4)
let guitar = note("e2 b2 e3 b2 a2 e3 a2 e2").s("gm_clean_guitar").velocity(.3)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, choir],
  [2, stack(choir, guitar)],
  [4, stack(choir, guitar, drums)])`,
      },
      {
        label: 'Male EDM Anthem',
        code: `// male EDM anthem — "Rise Together"
// Rise together higher than before
// Feel the bass line shaking through the floor
// Hands up everybody lose control
// Music is the fire in my soul
// We are one and that's the only goal
let choir = note("[c2,e2,g2] ~ [a1,c2,e2] ~ [f1,a1,c2] ~ [g1,b1,d2] ~")
  .s("gm_choir_aahs").velocity(.55).room(.4).slow(2)
let bass = note("c1 ~ c1 ~ a0 ~ g0 ~").s("sawtooth").lpf(300).gain(.4).shape(.3)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.55)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.45)

$: arrange(
  [2, stack(choir, bass)],
  [2, stack(choir, bass, kick)],
  [4, stack(choir, bass, kick, clap)])`,
      },
      {
        label: 'Male Lofi Whisper',
        code: `// male lofi whisper — "Quiet Hours"
// Quiet hours when the world stands still
// Coffee steam ascending from the sill
// Vinyl crackle memories unfold
// Every gentle note a tale retold
// Warmth inside when everything is cold
let choir = note("c3 e3 g3 b3 g3 e3 c3 ~").s("gm_choir_aahs")
  .velocity(sine.range(.2,.4).slow(8)).room(.45).lpf(1500)
let keys = note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.2).room(.35).lpf(2000).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, choir],
  [2, stack(choir, keys)],
  [4, stack(choir, keys, drums)])`,
      },
    ],
  },
  {
    category: 'Female Vocals',
    icon: '👩‍🎤',
    examples: [
      {
        label: 'High Oohs',
        code: `// high female oohs
let oohs = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.5).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Soprano Melody',
        code: `// soprano singing
let oohs = note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4)

$: arrange([4, oohs])`,
      },
      {
        label: 'High Hum',
        code: `// high female humming
let oohs = note("<c4 d4 e4 d4>")
  .s("gm_voice_oohs").velocity(.35)
  .lpf(3000).room(.5).slow(2)

$: arrange([4, oohs])`,
      },
      {
        label: 'Soprano Harmony',
        code: `// soprano harmony stack
let oohs = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.4).slow(2)

$: arrange([4, oohs])`,
      },
      {
        label: 'Ethereal Voice',
        code: `// ethereal female voice
let oohs = note("<[c4,g4,c5]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.85).roomsize(7).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Synth Voice',
        code: `// synthetic female voice
let synthVox = note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_synth_voice").velocity(.45)
  .room(.3)

$: arrange([4, synthVox])`,
      },
      {
        label: 'Delayed Oohs',
        code: `// delayed oohs
let oohs = note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.5).delayfeedback(.55)
  .room(.4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Chop',
        code: `// female vocal chop
let vox = s("chin:0 ~ chin:1 ~")
  .speed(1.5).gain(.5)
  .room(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'High Pad',
        code: `// high female pad
let oohs = note("<[c4,e4,g4,b4] [a3,c4,e4,g4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.6).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Soprano Swell',
        code: `// soprano vocal swell
let oohs = note("<[c4,g4]>")
  .s("gm_voice_oohs")
  .velocity(sine.range(.1,.45).slow(4))
  .room(.6).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Bright Melody',
        code: `// bright soprano melody
let oohs = note("g4 a4 b4 d5 c5 b4 g4 a4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.3)

$: arrange([4, oohs])`,
      },
      {
        label: 'Whisper Float',
        code: `// whisper floating
let breath = s("breath:0 ~ breath:2 ~")
  .gain(.3).room(.7).roomsize(5)
  .lpf(4000).slow(2)

$: arrange([4, breath])`,
      },
      {
        label: 'Female Reverb',
        code: `// female reverb cathedral
let oohs = note("<[c4,e4,g4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.9).roomsize(8).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Descending Line',
        code: `// descending vocal line
let oohs = note("c5 b4 g4 f4 e4 d4 c4 e4")
  .s("gm_voice_oohs").velocity(.4)
  .room(.4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Echo',
        code: `// echoing female voice
let oohs = note("c4 ~ ~ ~ e4 ~ ~ ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.6).delayfeedback(.6)
  .room(.5)

$: arrange([4, oohs])`,
      },
      {
        label: 'Staccato Ooh',
        code: `// staccato oohs
let oohs = note("c4 ~ c4 ~ e4 ~ c4 ~")
  .s("gm_voice_oohs").velocity(.4)
  .decay(.12)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Drone',
        code: `// droning female vocal
let oohs = note("[c4,g4]")
  .s("gm_voice_oohs").velocity(.3)
  .room(.7).roomsize(5)

$: arrange([4, oohs])`,
      },
      {
        label: 'Shimmer Voice',
        code: `// shimmering female
let oohs = note("<[c4,e4,g4,b4]>")
  .s("gm_voice_oohs").velocity(.3)
  .delay(.4).delayfeedback(.55)
  .room(.6).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Chopped',
        code: `// chopped female choir
let oohs = note("[c4,e4,g4]")
  .s("gm_voice_oohs").velocity(.35)
  .chop(8).room(.3)

$: arrange([4, oohs])`,
      },
      {
        label: 'Angelic Pad',
        code: `// angelic pad wash
let oohs = note("<[c4,g4,c5] [a3,e4,a4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.8).roomsize(6).slow(4)

$: arrange([4, oohs])`,
      },
      {
        label: 'High Stutter',
        code: `// stuttered high voice
let vox = s("chin:1").chop(16)
  .speed(1.5).gain(.5)
  .room(.3)

$: arrange([4, vox])`,
      },
      {
        label: 'Vowel Morph',
        code: `// female vowel morph
let synth = note("c4*4").s("sawtooth")
  .gain(.3).vowel("<a e i o u>")
  .lpf(4000)

$: arrange([4, synth])`,
      },
      {
        label: 'Crystal Voice',
        code: `// crystal clear vocal
let oohs = note("c5 e5 g5 c6")
  .s("gm_voice_oohs").velocity(.35)
  .room(.6).delay(.2).slow(2)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Vibrato',
        code: `// vibrato vocal
let oohs = note("c4").s("gm_voice_oohs")
  .velocity(.4)
  .vibmod(.1).vibdepth(2)
  .room(.5)

$: arrange([4, oohs])`,
      },
      {
        label: 'Lullaby',
        code: `// lullaby melody
let oohs = note("c4 d4 e4 g4 e4 d4 c4 d4")
  .s("gm_voice_oohs").velocity(.35)
  .room(.5).delay(.2).slow(2)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female Crushed',
        code: `// crushed female voice
let oohs = note("c4 e4 g4 c5")
  .s("gm_voice_oohs").velocity(.4)
  .crush(10).room(.3)

$: arrange([4, oohs])`,
      },
      {
        label: 'Pitched Breath',
        code: `// pitched breathy vocal
let breath = s("breath:0 breath:1 breath:2 breath:0")
  .speed("<1 1.5 .75 1.25>")
  .gain(.35).room(.5).slow(2)

$: arrange([4, breath])`,
      },
      {
        label: 'Glissando',
        code: `// vocal glissando
let oohs = note("c4 d4 e4 f4 g4 a4 b4 c5")
  .s("gm_voice_oohs").velocity(.4)
  .glide(.1).room(.4)

$: arrange([4, oohs])`,
      },
      {
        label: 'Female + Beat',
        code: `// female vocal over beat
let drums = s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
let hats = s("[~ hh]*4").bank("RolandTR808").gain(.3)
let oohs = note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.4).slow(2)

$: arrange(
  [2, drums],
  [2, stack(drums, hats)],
  [4, stack(drums, hats, oohs)])`,
      },
      {
        label: 'Full Female Harmony',
        code: `// full female harmony
let oohs = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.5).slow(2)
let oohs2 = note("<[c5,e5,g5]>")
  .s("gm_voice_oohs").velocity(.2)
  .room(.6).slow(4)

$: arrange(
  [2, oohs],
  [4, stack(oohs, oohs2)])`,
      },
      {
        label: 'Female R&B Silk',
        code: `// female R&B silk — "Satin Dreams"
// Satin dreams are falling through my hands
// Moonlit whispers only love understands
// Touch me like the ocean meets the shore
// Every breath is begging you for more
// Open up the window close the door
let oohs = note("c5 d5 e5 g5 f5 e5 d5 c5").s("gm_voice_oohs")
  .velocity(sine.range(.3,.55).slow(8)).room(.5).delay(.12)
let keys = note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.25).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.2)

$: arrange(
  [2, stack(oohs, keys)],
  [2, stack(oohs, keys, drums)],
  [4, stack(oohs, keys, drums, hats)])`,
      },
      {
        label: 'Female Pop Soar',
        code: `// female pop soar — "Crystal Wings"
// Crystal wings are carrying me high
// Every star a diamond in the sky
// Singing loud until the echoes fade
// Brave enough to stand inside the rain
// I was born to fly and not afraid
let oohs = note("e5 d5 c5 b4 c5 d5 e5 ~").s("gm_voice_oohs")
  .velocity(.55).room(.4).delay(.1)
let keys = note("[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]")
  .s("gm_bright_piano").velocity(.3).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.45)
let hats = s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.2)

$: arrange(
  [2, stack(oohs, keys)],
  [2, stack(oohs, keys, drums)],
  [4, stack(oohs, keys, drums, hats)])`,
      },
      {
        label: 'Female Jazz Velvet',
        code: `// female jazz velvet — "Candlelit Room"
// Candlelit room where the shadows play
// Swinging soft through notes of cabernet
// Fingers trace the rim of crystal glass
// Every moment hoping this will last
// Melody as smooth as polished brass
let oohs = note("g4 a4 b4 d5 c5 b4 a4 g4").s("gm_voice_oohs")
  .velocity(.45).room(.5).delay(.18)
let bass = note("g2 d3 c3 g2 f2 c3 b2 g2").s("gm_acoustic_bass").velocity(.45)
let hats = s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)

$: arrange(
  [2, oohs],
  [2, stack(oohs, bass)],
  [4, stack(oohs, bass, hats)])`,
      },
      {
        label: 'Female Gospel Fire',
        code: `// female gospel fire — "Holy Water"
// Holy water runnin' through my veins
// Break the shackles loose from all the chains
// Lift your hands and let the spirit move
// Nothing in this world we got to prove
// Heaven opens up from every groove
let oohs = note("c5 e5 f5 g5 a5 g5 f5 e5").s("gm_voice_oohs")
  .velocity(.6).room(.6)
let organ = note("[c4,e4,g4] ~ [f4,a4,c5] ~ [g4,b4,d5] ~ [c4,e4,g4] ~")
  .s("gm_church_organ").velocity(.35).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
let clap = s("~ cp ~ cp").bank("RolandTR909").gain(.35)

$: arrange(
  [2, stack(oohs, organ)],
  [2, stack(oohs, organ, drums)],
  [4, stack(oohs, organ, drums, clap)])`,
      },
      {
        label: 'Female Soul Deep',
        code: `// female soul deep — "Golden Hour"
// Golden hour painting everything so warm
// Shelter me from every passing storm
// Sing until the tears become a song
// Holding on when everything goes wrong
// Baby I have loved you all along
let oohs = note("c4 e4 f4 g4 f4 e4 c4 ~").s("gm_voice_oohs")
  .velocity(sine.range(.35,.6).slow(6)).room(.45)
let keys = note("[c3,e3,g3] ~ [a2,c3,e3] ~ [b2,d3,f3] ~ [c3,e3,g3] ~")
  .s("gm_epiano1").velocity(.25).slow(2)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, keys)],
  [4, stack(oohs, keys, drums)])`,
      },
      {
        label: 'Female Indie Dream',
        code: `// female indie dream — "Paper Kites"
// Paper kites above the rooftop line
// Tangled up in yours and tangled up in mine
// Coffee rings on yesterday's gazette
// Dancing to a song we can't forget
// This is close to beautiful as it gets
let oohs = note("e4 g4 a4 b4 a4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.45).room(.4).delay(.15)
let guitar = note("e3 b3 e4 b3 a3 e4 a3 e3").s("gm_clean_guitar").velocity(.3)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, guitar)],
  [4, stack(oohs, guitar, drums)])`,
      },
      {
        label: 'Female Country Heart',
        code: `// female country heart — "Wildflower Road"
// Wildflower road beneath a painted sky
// Pickup truck and time is drifting by
// Sang along to every song we knew
// Summer fading into autumn blue
// Darlin I keep coming back to you
let oohs = note("e4 g4 g4 a4 g4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.45).room(.4)
let guitar = note("e3 a3 b3 e3 a3 b3 e3 a3").s("gm_steel_guitar").velocity(.3)
let bass = note("e2 ~ a1 ~ b1 ~ e2 ~").s("gm_acoustic_bass").velocity(.4)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, guitar)],
  [2, stack(oohs, guitar, bass)],
  [4, stack(oohs, guitar, bass, drums)])`,
      },
      {
        label: 'Female Reggae Queen',
        code: `// female reggae queen — "Island Breeze"
// Island breeze is blowin' through my hair
// Music floatin' salty in the air
// Dancin' barefoot in the moonlit sand
// Every riddim makes me understand
// Love is all we need across the land
let oohs = note("g4 b4 c5 d5 c5 b4 g4 ~").s("gm_voice_oohs")
  .velocity(.45).room(.5).delay(.2)
let bass = note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
let drums = s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.45)

$: arrange(
  [2, oohs],
  [2, stack(oohs, bass)],
  [4, stack(oohs, bass, drums)])`,
      },
      {
        label: 'Female Blues Ache',
        code: `// female blues ache — "Broken Mirror"
// Broken mirror seven years of rain
// Lipstick traces on the windowpane
// Sang my heart out on a corner stage
// Ink is bleeding through the final page
// Blues don't care about a woman's age
let oohs = note("e4 g4 a4 b4 a4 g4 e4 ~").s("gm_voice_oohs")
  .velocity(sine.range(.35,.6).slow(6)).room(.45)
let guitar = note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.35)
let drums = s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)

$: arrange(
  [2, oohs],
  [2, stack(oohs, guitar)],
  [4, stack(oohs, guitar, drums)])`,
      },
      {
        label: 'Female Afro Glow',
        code: `// female afro glow — "Golden Dust"
// Golden dust is spinning in the light
// Dancing through the fire every night
// Drums are speaking truth from long ago
// Every step a river every step a flow
// Voices of the ancestors below
let oohs = note("d5 f5 g5 a5 g5 f5 d5 c5").s("gm_voice_oohs")
  .velocity(.5).room(.4).delay(.15)
let bass = note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_synth_bass_1").velocity(.55)
let drums = s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
let hats = s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, hats)])`,
      },
      {
        label: 'Female Latin Flame',
        code: `// female latin flame — "Luna Roja"
// Luna roja bailando en la noche
// Fuego crece con cada reproche
// Canto libre bajo cielo abierto
// Cada nota vuelve lo que es cierto
// El amor es siempre un puerto
let oohs = note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_voice_oohs")
  .velocity(.5).room(.35).delay(.1)
let bass = note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.5)
let drums = s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, rim)])`,
      },
      {
        label: 'Female Dance Diva',
        code: `// female dance diva — "Strobe Light"
// Strobe light flashing on the dancing floor
// Give me bass and then give me some more
// Hands are waving high above the crowd
// DJ spin it louder make it loud
// Every beat a heartbeat I am proud
let synthChoir = note("[c4,e4,g4] ~ [a3,c4,e4] ~ [f3,a3,c4] ~ [g3,b3,d4] ~")
  .s("gm_synth_choir").velocity(.5).room(.35).slow(2)
let bass = note("c2 ~ c2 ~ a1 ~ g1 ~").s("sawtooth").lpf(400).gain(.4).shape(.25)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.55)
let clap = s("~ cp ~ ~").bank("RolandTR909").gain(.45)

$: arrange(
  [2, stack(synthChoir, bass)],
  [2, stack(synthChoir, bass, kick)],
  [4, stack(synthChoir, bass, kick, clap)])`,
      },
      {
        label: 'Female Lullaby Soft',
        code: `// female lullaby soft — "Moonbeam"
// Moonbeam falling gentle on your face
// Wrapped in stardust floating into space
// Close your eyes the night will hold you tight
// Dream of everything that feels so right
// I will sing you into morning light
let oohs = note("c5 b4 a4 g4 a4 g4 f4 e4").s("gm_voice_oohs")
  .velocity(sine.range(.2,.4).slow(8)).room(.55).slow(2)
let bells = note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_music_box").velocity(.2).slow(4)

$: arrange(
  [2, oohs],
  [4, stack(oohs, bells)])`,
      },
      {
        label: 'Female Funk Sassy',
        code: `// female funk sassy — "Hot Sauce"
// Hot sauce on the rhythm watch it burn
// Every single head is gonna turn
// Slap that bass and hit the one real hard
// Strutting through the club like a queen of cards
// Funky diva never dropping guard
let oohs = note("c4 ~ e4 f4 ~ e4 c4 ~").s("gm_voice_oohs")
  .velocity(.55).room(.3)
let bass = note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.55)
let drums = s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
let brass = note("~ [e5,g5] ~ ~ ~ [f5,a5] ~ ~").s("gm_brass1").velocity(.35)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, brass)])`,
      },
      {
        label: 'Female Opera Aria',
        code: `// female opera aria — "Starlight Opera"
// Starlight opera echoing through halls
// Crystal chandeliers and marble walls
// Every phrase a painting in the air
// Beauty woven through a golden prayer
// Let the music take away all care
let oohs = note("c5 ~ d5 ~ e5 ~ c5 ~").s("gm_voice_oohs")
  .velocity(.5).room(.8).roomsize(7).slow(2)
let strings = note("[c4,g4,c5] ~ [d4,a4,d5] ~ [e4,b4,e5] ~ [c4,g4,c5] ~")
  .s("gm_strings1").velocity(.3).room(.7).slow(2)

$: arrange(
  [2, oohs],
  [4, stack(oohs, strings)])`,
      },
      {
        label: 'Female Hip-Hop Hook',
        code: `// female hip-hop hook — "Crown Royal"
// Crown royal sitting on my throne
// Built this empire from the ground alone
// Every bar I spit is platinum laced
// Haters running but they can't keep pace
// Queen of every stage that I have graced
let oohs = note("c4 c4 e4 f4 e4 c4 ~ c4").s("gm_voice_oohs")
  .velocity(.5).room(.25)
let bass = note("c1 ~ c1 ~ e1 ~ f1 ~").s("gm_synth_bass_1").velocity(.55)
let drums = s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.5)
let hats = s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, hats)])`,
      },
      {
        label: 'Female Ambient Glow',
        code: `// female ambient glow — "Cloud Garden"
// Cloud garden floating over silver streams
// Weaving melodies between my dreams
// Echo of a voice beyond the hill
// Time is frozen and the world is still
// Singing softly because silence fills
let oohs = note("<c5 d5 e5 f5 e5 d5 c5 b4>")
  .s("gm_voice_oohs").velocity(sine.range(.15,.35).slow(16))
  .room(.8).delay(.35).slow(4)
let pad = note("<[c3,e3,g3] [b2,d3,f3]>")
  .s("gm_warm_pad").velocity(.2).room(.65).slow(8)

$: arrange(
  [2, oohs],
  [4, stack(oohs, pad)])`,
      },
      {
        label: 'Female Dancehall Fire',
        code: `// female dancehall fire — "Gyal Power"
// Gyal power nothing can we stop
// Riddim drop and all the people rock
// Wine it up from bottom to the top
// Sound a play and speakers gonna pop
// Queens we are and queens on every block
let oohs = note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_voice_oohs")
  .velocity(.5).room(.3).delay(.1)
let bass = note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.55)
let drums = s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.5)
let rim = s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)

$: arrange(
  [2, stack(oohs, bass)],
  [2, stack(oohs, bass, drums)],
  [4, stack(oohs, bass, drums, rim)])`,
      },
      {
        label: 'Female Electro Synth',
        code: `// female electro synth — "Neon Pulse"
// Neon pulse is racing through the wire
// Synthesized emotions burning higher
// Code is music music is the code
// Glowing circuits light the endless road
// Digital the future we have sowed
let synthChoir = note("<[c4,e4,g4] [a3,c4,e4]>").s("gm_synth_choir")
  .velocity(.45).room(.4).slow(2)
let synthVox = note("c5 e5 g5 ~ e5 c5 ~ g4").s("gm_synth_voice")
  .velocity(.3).delay(.25)
let kick = s("bd bd bd bd").bank("RolandTR909").gain(.5)
let hats = s("~ hh ~ oh ~ hh ~ oh").bank("RolandTR909").gain(.3)

$: arrange(
  [2, stack(synthChoir, synthVox)],
  [2, stack(synthChoir, synthVox, kick)],
  [4, stack(synthChoir, synthVox, kick, hats)])`,
      },
    ],
  },
  {
    category: 'Shakers',
    icon: '🎯',
    examples: [
      {
        label: 'Egg Shaker — Gentle',
        code: `// egg shaker — gentle eighth notes
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.4)
  .lpf(3500).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Egg Shaker — Quick',
        code: `// egg shaker — quick sixteenths
let shaker = s("hh*8").bank("RolandTR808")
  .gain("[.15 .3 .2 .35 .15 .3 .2 .35]")
  .speed(1.5).lpf(3000).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Egg Shaker — Shuffle',
        code: `// egg shaker — shuffle feel
let shaker = s("[hh ~ hh] [~ hh ~] [hh ~ hh] [~ hh ~]")
  .bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .2]")
  .speed(1.45).lpf(3200).hpf(850)

$: arrange([4, shaker])`,
      },
      {
        label: 'Cabasa — Steady',
        code: `// cabasa — steady groove
let shaker = s("hh*4").bank("RolandTR909")
  .gain("[.35 .55 .4 .6]").speed(1.8)
  .lpf(5000).hpf(1200)

$: arrange([4, shaker])`,
      },
      {
        label: 'Cabasa — Syncopated',
        code: `// cabasa — syncopated rhythm
let shaker = s("[hh ~] hh [~ hh] [hh hh]").bank("RolandTR909")
  .gain("[.3 .5 .4 .55]").speed(1.75)
  .lpf(4800).hpf(1100)

$: arrange([4, shaker])`,
      },
      {
        label: 'Cabasa — Fast Scrape',
        code: `// cabasa — fast scrape texture
let shaker = s("hh*16").bank("RolandTR909")
  .gain(sine.range(.15,.45).fast(4))
  .speed("[1.7 1.8 1.75 1.85]*4")
  .lpf(5500).hpf(1300)

$: arrange([4, shaker])`,
      },
      {
        label: 'Maracas — Classic',
        code: `// maracas — classic Latin pattern
let shaker = s("hh hh [hh hh] hh").bank("RolandTR808")
  .gain("[.3 .5 .7 .5]")
  .speed("[2 2.1 2 2.15]").lpf(6000).hpf(1500)

$: arrange([4, shaker])`,
      },
      {
        label: 'Maracas — Double Time',
        code: `// maracas — double time shake
let shaker = s("hh*8").bank("RolandTR808")
  .gain("[.25 .45 .3 .5 .25 .45 .3 .5]")
  .speed("[2 2.1 2.05 2.15 2 2.1 2.05 2.15]")
  .lpf(6500).hpf(1600)

$: arrange([4, shaker])`,
      },
      {
        label: 'Maracas — Cumbia',
        code: `// maracas — cumbia groove
let shaker = s("[hh hh] hh [hh hh] hh [hh ~] hh")
  .bank("RolandTR808")
  .gain("[.3 .55 .4 .6 .5 .3]")
  .speed("[2 2.1 1.95 2.15 2.05 2]")
  .lpf(5800).hpf(1400)

$: arrange([4, shaker])`,
      },
      {
        label: 'Tambourine — On Beat',
        code: `// tambourine — on every beat
let openHat = s("oh*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .55]").speed(1.6)
  .lpf(7000).hpf(1000)

$: arrange([4, openHat])`,
      },
      {
        label: 'Tambourine — Backbeat',
        code: `// tambourine — backbeat hits
let openHat = s("~ oh ~ oh").bank("RolandTR808")
  .gain("[.4 .6]").speed(1.55)
  .lpf(6500).hpf(950)

$: arrange([4, openHat])`,
      },
      {
        label: 'Tambourine — Gospel Roll',
        code: `// tambourine — gospel roll
let openHat = s("[oh oh] oh [oh oh] [oh oh oh]")
  .bank("RolandTR808")
  .gain("[.25 .4 .35 .5 .6 .45 .55 .35]")
  .speed("[1.55 1.6 1.5 1.65 1.55 1.6 1.5 1.6]")
  .lpf(7000).hpf(1000)

$: arrange([4, openHat])`,
      },
      {
        label: 'Tambourine — Sizzle',
        code: `// tambourine — sizzle and shimmer
let openHat = s("oh*8").bank("RolandTR909")
  .gain("[.15 .3 .2 .4 .2 .35 .2 .4]")
  .speed(1.65).lpf(8000).hpf(1100).room(.2)

$: arrange([4, openHat])`,
      },
      {
        label: 'Rain Stick — Slow',
        code: `// rain stick — slow falling beads
let shaker = s("hh(5,8)").bank("RolandTR808")
  .gain(sine.range(.1,.35).slow(4))
  .speed(sine.range(1.2,2).slow(8))
  .lpf(2500).hpf(600).room(.45).delay(.15)

$: arrange([4, shaker])`,
      },
      {
        label: 'Rain Stick — Dense',
        code: `// rain stick — dense bead cascade
let shaker = s("hh(7,16)").bank("RolandTR808")
  .gain(sine.range(.08,.3).slow(6))
  .speed(sine.range(1.5,2.5).slow(4))
  .lpf(3000).hpf(700).room(.5).delay(.2)

$: arrange([4, shaker])`,
      },
      {
        label: 'Seed Shaker — Soft',
        code: `// seed shaker — soft organic rattle
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.12 .22 .15 .25]").speed(1.3)
  .lpf(2200).hpf(500).room(.3)

$: arrange([4, shaker])`,
      },
      {
        label: 'Seed Shaker — Groove',
        code: `// seed shaker — groove pocket
let shaker = s("[hh ~] [~ hh] [hh hh] [~ hh]")
  .bank("RolandTR808")
  .gain("[.15 .28 .2 .32]").speed(1.35)
  .lpf(2400).hpf(550).room(.25)

$: arrange([4, shaker])`,
      },
      {
        label: 'Caxixi — Berimbau',
        code: `// caxixi — berimbau accompaniment
let shaker = s("[hh hh] [~ hh] [hh hh] [hh ~]")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .45 .3]")
  .speed("[1.6 1.7 1.55 1.7 1.6 1.65]")
  .lpf(4000).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Caxixi — Fast',
        code: `// caxixi — fast capoeira pattern
let shaker = s("hh*8").bank("RolandTR808")
  .gain("[.25 .45 .3 .5 .25 .45 .35 .55]")
  .speed("[1.6 1.7 1.65 1.75 1.6 1.7 1.65 1.75]")
  .lpf(4200).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shekere — West African',
        code: `// shekere — West African net rattle
let shaker = s("[oh hh] oh [hh oh] [oh hh oh]")
  .bank("RolandTR808")
  .gain("[.35 .55 .45 .6 .5 .4 .55]")
  .speed("[1.3 1.5 1.35 1.45 1.3 1.5 1.4]")
  .lpf(5000).hpf(700)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shekere — Polyrhythm',
        code: `// shekere — polyrhythmic pattern
let openHat = s("oh(5,8)").bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .45]")
  .speed("[1.35 1.5 1.4 1.45 1.35]")
  .lpf(4800).hpf(750)
let shaker = s("hh(3,8)").bank("RolandTR808")
  .gain("[.25 .4 .35]").speed(1.6)
  .lpf(4000).hpf(800)

$: arrange(
  [2, openHat],
  [4, stack(openHat, shaker)])`,
      },
      {
        label: 'Güiro — Scrape Rhythm',
        code: `// güiro — scrape rhythm
let shaker = s("[hh hh hh hh] hh [hh hh hh hh] hh")
  .bank("RolandTR909")
  .gain("[.2 .25 .3 .25 .5 .2 .25 .3 .25 .5]")
  .speed("[1.9 2 2.1 2 1.5 1.9 2 2.1 2 1.5]")
  .lpf(5500).hpf(1200)

$: arrange([4, shaker])`,
      },
      {
        label: 'Güiro — Cha-Cha',
        code: `// güiro — cha-cha pattern
let shaker = s("[hh hh hh] hh ~ [hh hh hh] hh ~")
  .bank("RolandTR909")
  .gain("[.25 .3 .35 .5 .25 .3 .35 .5]")
  .speed("[1.95 2.05 2.1 1.6 1.95 2.05 2.1 1.6]")
  .lpf(5200).hpf(1100)

$: arrange([4, shaker])`,
      },
      {
        label: 'Vibraslap — Buzz',
        code: `// vibraslap — buzzing rattle
let openHat = s("~ ~ ~ oh").bank("RolandTR808")
  .gain(.5).speed(.7)
  .lpf(2000).hpf(300).room(.35).slow(2)

$: arrange([4, openHat])`,
      },
      {
        label: 'Hi-Hat Shaker — Trap',
        code: `// hi-hat shaker — trap rolls
let shaker = s("hh*16").bank("RolandTR808")
  .gain("[.2 .35 .25 .45 .2 .35 .25 .45 .3 .5 .35 .55 .3 .5 .35 .55]")
  .speed("[1.3 1.35 1.25 1.4]*4")
  .lpf(4000).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Hi-Hat Shaker — House',
        code: `// hi-hat shaker — house offbeat
let shaker = s("[~ hh]*4").bank("RolandTR909")
  .gain("[.35 .5 .4 .55]")
  .speed(1.35).lpf(4500).hpf(700)

$: arrange([4, shaker])`,
      },
      {
        label: 'Hi-Hat Shaker — DnB',
        code: `// hi-hat shaker — drum & bass
let shaker = s("hh*8").bank("RolandTR909").fast(2)
  .gain("[.2 .4 .25 .45 .2 .4 .3 .5]")
  .speed("[1.3 1.4 1.35 1.45 1.3 1.4 1.35 1.45]")
  .lpf(5000).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Noise Shaker — White',
        code: `// noise shaker — white noise burst
let shaker = s("hh*4").bank("RolandTR808")
  .gain("[.25 .45 .3 .5]").speed(2.5)
  .lpf(4000).hpf(2000)

$: arrange([4, shaker])`,
      },
      {
        label: 'Noise Shaker — Pink',
        code: `// noise shaker — filtered pink feel
let shaker = s("hh*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .55]").speed(2.2)
  .lpf(2500).hpf(400).room(.2)

$: arrange([4, shaker])`,
      },
      {
        label: 'Noise Shaker — Filtered Sweep',
        code: `// noise shaker — filter sweep
let shaker = s("hh*8").bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .2 .35 .25 .4]")
  .speed(2).lpf(sine.range(1500,6000).slow(4))
  .hpf(sine.range(400,1500).slow(8))

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Layered Thick',
        code: `// layered thick shaker — two textures
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.4)
  .lpf(3500).hpf(800)
let shaker2 = s("[~ hh]*4").bank("RolandTR909")
  .gain("[.15 .25 .18 .3]").speed(1.8)
  .lpf(5000).hpf(1200)

$: arrange(
  [2, shaker],
  [4, stack(shaker, shaker2)])`,
      },
      {
        label: 'Shaker — Layered Wide',
        code: `// layered wide shaker — stereo spread
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.45)
  .lpf(3200).hpf(700).pan(0.3)
let shaker2 = s("[~ hh]*4").bank("RolandTR909")
  .gain("[.15 .28 .2 .33]").speed(1.7)
  .lpf(5500).hpf(1100).pan(0.7)

$: arrange(
  [2, shaker],
  [4, stack(shaker, shaker2)])`,
      },
      {
        label: 'Shaker — World Fusion',
        code: `// world fusion — egg + tambourine + maracas
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.15 .28 .2 .32]").speed(1.4)
  .lpf(3000).hpf(800)
let openHat = s("~ oh ~ oh").bank("RolandTR808")
  .gain("[.3 .45]").speed(1.55)
  .lpf(6500).hpf(950)
let shaker2 = s("hh hh [hh hh] hh").bank("RolandTR808")
  .gain("[.2 .35 .5 .35]").speed(2.1)
  .lpf(6000).hpf(1500)

$: arrange(
  [2, shaker],
  [2, stack(shaker, openHat)],
  [4, stack(shaker, openHat, shaker2)])`,
      },
      {
        label: 'Shaker — Minimal',
        code: `// minimal micro shaker — barely there
let shaker = s("hh(3,8)").bank("RolandTR808")
  .gain("[.08 .15 .12]").speed(1.5)
  .lpf(2500).hpf(600).room(.4)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Hypnotic',
        code: `// hypnotic shaker — evolving texture
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain(sine.range(.1,.4).slow(8))
  .speed(sine.range(1.2,1.8).slow(4))
  .lpf(sine.range(2000,5000).slow(6))
  .hpf(sine.range(400,1200).slow(12)).room(.3)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Polyrhythm',
        code: `// polyrhythmic shaker — 3 against 4
let shaker = s("hh(3,8)").bank("RolandTR808")
  .gain("[.25 .4 .35]").speed(1.45)
  .lpf(3500).hpf(800)
let shaker2 = s("hh(4,8)").bank("RolandTR909")
  .gain("[.2 .35 .25 .4]").speed(1.7)
  .lpf(5000).hpf(1100)

$: arrange(
  [2, shaker],
  [4, stack(shaker, shaker2)])`,
      },
      {
        label: 'Shaker — Euclidean 5/8',
        code: `// euclidean shaker — 5 hits in 8 slots
let shaker = s("hh(5,8)").bank("RolandTR808")
  .gain("[.25 .4 .3 .45 .35]")
  .speed("[1.4 1.5 1.45 1.55 1.4]")
  .lpf(4000).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Euclidean 7/16',
        code: `// euclidean shaker — 7 hits in 16 slots
let shaker = s("hh(7,16)").bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .38 .28]")
  .speed("[1.5 1.6 1.55 1.65 1.5 1.6 1.55]")
  .lpf(4200).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Swing',
        code: `// swing shaker — jazz feel
let shaker = s("[hh ~ hh] [~ hh ~] [hh ~ hh] [~ hh hh]")
  .bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .2]")
  .speed(1.45).lpf(3200).hpf(700).room(.3)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Bossa Nova',
        code: `// bossa nova shaker
let shaker = s("hh [hh hh] hh hh [hh hh] hh hh")
  .bank("RolandTR808")
  .gain("[.2 .35 .3 .25 .35 .3 .2 .3]")
  .speed(1.5).lpf(3500).hpf(750)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Samba',
        code: `// samba ganzá shaker
let shaker = s("[hh hh] hh [hh hh] hh [hh hh] hh")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .35 .5]")
  .speed("[1.6 1.7 1.6 1.7 1.6 1.7]")
  .lpf(4500).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Reggae Skank',
        code: `// reggae offbeat skank shaker
let shaker = s("~ hh ~ hh ~ hh ~ hh")
  .bank("RolandTR808")
  .gain("[.25 .4 .3 .45]").speed(1.35)
  .lpf(3000).hpf(600).room(.3)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Afrobeat',
        code: `// afrobeat shaker pattern
let shaker = s("[hh hh] hh [hh hh] hh [hh hh] hh [hh ~]")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .35 .5 .45]")
  .speed("[1.5 1.6 1.5 1.6 1.5 1.6 1.5]")
  .lpf(4000).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Dancehall',
        code: `// dancehall shaker riddim
let shaker = s("hh [hh hh] [~ hh] hh").bank("RolandTR808")
  .gain("[.3 .5 .45 .4]")
  .speed("[1.4 1.5 1.45 1.35]")
  .lpf(4500).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Funk',
        code: `// funk shaker — tight pocket
let shaker = s("[hh ~] hh [~ hh] hh [hh hh] [~ hh]")
  .bank("RolandTR909")
  .gain("[.3 .5 .4 .55 .6 .4]")
  .speed(1.5).lpf(4500).hpf(900)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Disco',
        code: `// disco shaker shimmer
let shaker = s("[~ hh]*4, oh(1,8)").bank("RolandTR909")
  .gain("[.3 .5 .4 .6]").speed(1.5)
  .lpf(5000).hpf(800)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Techno',
        code: `// techno industrial shaker
let shaker = s("hh*16").bank("RolandTR909")
  .gain(sine.range(.15,.5).fast(4))
  .speed("[1.4 1.5 1.45 1.55]*4")
  .lpf(5000).hpf(1000)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Lo-Fi Dusty',
        code: `// lo-fi dusty shaker — vinyl feel
let shaker = s("[~ hh]*4").bank("RolandTR808")
  .gain("[.12 .22 .15 .25]").speed(1.3)
  .lpf(2000).hpf(400).room(.35)

$: arrange([4, shaker])`,
      },
      {
        label: 'Shaker — Ambient Drift',
        code: `// ambient drifting shaker
let shaker = s("hh(5,16)").bank("RolandTR808")
  .gain(sine.range(.05,.25).slow(8))
  .speed(sine.range(1.2,2).slow(12))
  .lpf(sine.range(1500,4000).slow(6))
  .hpf(500).room(.55).delay(.25)

$: arrange([4, shaker])`,
      },
    ],
  },
]

export default function InputEditor() {
  const [code, setCode] = useState(`// 444 RADIO — INPUT
// Ctrl+Space to play · drag sliders to shape your vibe
// tip: write slider(value, min, max) anywhere to create live knobs!

setcps(72/60/4) // 72 bpm

// ── rain on glass ──
$: s("hh*16").bank("RolandTR808")
  .gain(slider(.035, 0, .1))
  .speed("[2.1 2.5 2.3 2.7]*2")
  .lpf(1400).hpf(700)
  .room(.6).pan(sine.range(.1,.9).slow(20))
  .delay(.18).delayfeedback(.42).delaytime(.375)
  .scope({color:"#475569",thickness:1,smear:.98})

// ── kick — soft pillow ──
$: s("[bd ~ ~ ~] ~ [~ bd] ~")
  .bank("RolandTR808")
  .gain(slider(.28, 0, .45))
  .lpf(350).room(.3).shape(.15)
  .scope({color:"#334155",thickness:2,smear:.88})
  .punchcard()

// ── snare ghost ──
$: s("~ [~ cp] ~ [~ ~ cp ~]")
  .bank("RolandTR808")
  .gain(.13).lpf(1400).room(.5)
  .delay(.08).delayfeedback(.15)
  .scope({color:"#64748b",thickness:1,smear:.91})

// ── hats — scattered drops ──
$: s("[~ oh] [hh ~ ~ hh] [~ hh] [oh ~ hh ~]")
  .bank("RolandTR808")
  .gain("[.06 .1 .05 .09]")
  .speed("[1 1.2 .95 1.15]")
  .lpf(2600).hpf(900)
  .delay(slider(.12, 0, .35)).delayfeedback(.28)
  .room(.25)
  .scope({color:"#94a3b8",thickness:1,smear:.94})

// ── rhodes — jazzy warmth ──
$: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3] [f3,a3,c4,e4] [e3,g3,b3,d4] [d3,f3,a3,c4] [e3,gs3,b3,d4]>")
  .s("gm_epiano1").velocity(slider(.14, .05, .25))
  .lpf(sine.range(900,2000).slow(32))
  .room(slider(.55, .2, .85)).delay(.2).delayfeedback(.32)
  .slow(2)
  .pianoroll({cycles:16,color:"#22d3ee"})
  .scope({color:"#67e8f9",thickness:1,smear:.93})

// ── bass — deep pocket ──
$: note("<[d2 ~ ~ d2] [~ g1 ~ ~] [c2 ~ ~ ~] [~ a1 ~ a1] [f1 ~ ~ f2] [~ e2 ~ ~] [d2 ~ ~ ~] [~ e2 ~ ~]>")
  .s("sine").gain(slider(.22, 0, .38))
  .lpf(100).room(.12).slow(2)
  .scope({color:"#0e7490",thickness:2.5,smear:.96})

// ── piano — lonely melody ──
$: note("<[~ d4 ~ ~ f4 ~ a4 ~] [~ ~ g4 ~ b4 ~ ~ d5] [~ e4 ~ g4 ~ ~ b4 ~] [~ ~ a4 ~ ~ e4 ~ g4] [~ f4 ~ a4 ~ c5 ~ ~] [~ ~ g4 ~ b4 ~ e4 ~] [~ d4 ~ ~ a4 ~ f4 ~] [~ ~ e4 ~ ~ gs4 ~ b4]>")
  .s("gm_piano").velocity(slider(.08, .02, .18))
  .lpf(sine.range(1200,2800).slow(28))
  .room(.7).delay(slider(.22, 0, .45)).delayfeedback(.38)
  .slow(2)
  .pitchwheel()
  .scope({color:"#a5b4fc",thickness:1,smear:.91})

// ── music box shimmer ──
$: note("<[~ ~ a5 ~ ~ ~ ~ ~] [~ ~ ~ d5 ~ ~ ~ ~] [~ ~ ~ ~ g5 ~ ~ ~] [~ ~ e5 ~ ~ ~ ~ ~] [~ ~ c5 ~ ~ ~ ~ ~] [~ ~ ~ b5 ~ ~ ~ ~] [~ ~ a5 ~ ~ ~ ~ ~] [~ ~ ~ ~ gs5 ~ ~ ~]>")
  .s("gm_music_box").velocity(slider(.04, 0, .1))
  .lpf(3200).room(.8).delay(.3).delayfeedback(.5)
  .slow(2)
  .scope({color:"#e0f2fe",thickness:1,smear:.96})

// ── pad — evening haze ──
$: note("<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4] [f3,c4,a4] [e3,b3,g4] [d3,a3,f4] [e3,b3,d4]>")
  .s("sawtooth").gain(slider(.02, 0, .05))
  .lpf(sine.range(180,650).slow(40))
  .room(.85).delay(.3).delayfeedback(.48)
  .slow(4)
  .fscope()

// ── vinyl crackle ──
$: s("hh*8").bank("RolandTR808")
  .gain(sine.range(.004,.015).slow(28))
  .speed(3.4).lpf(550).hpf(450)
  .room(.2).pan(sine.range(.3,.7).slow(10))

// ── distant rumble ──
$: s("bd:3").bank("RolandTR808")
  .gain(sine.range(0,.035).slow(24))
  .speed(.22).lpf(140)
  .room(.95).delay(.45).delayfeedback(.52)
  .slow(16)
`)

  const [isPlaying, setIsPlaying] = useState(false)
  const [activeHaps, setActiveHaps] = useState<string[]>([])
  const [highlightRanges, setHighlightRanges] = useState<{start: number, end: number}[]>([])
  const activeLocsRef = useRef<{start: number, end: number}[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading')
  const [loadingMsg, setLoadingMsg] = useState('initializing...')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const codeRef = useRef(code) // always-fresh code for callbacks
  codeRef.current = code
  const strudelRef = useRef<any>(null)
  const soundMapRef = useRef<any>(null)
  const webaudioRef = useRef<any>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const lastEvaluatedRef = useRef('') // Tracks last evaluated code to skip redundant evaluates
  const isPlayingRef = useRef(false)
  const handleUpdateRef = useRef<(force?: boolean) => Promise<void>>(async () => {})
  // Sync isPlayingRef whenever isPlaying changes (for use in stable callbacks)
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  const glowRef = useRef<HTMLDivElement>(null)
  const glowRafRef = useRef<number>(0)
  const activeHapsRef = useRef<Set<string>>(new Set())
  const editorContainerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawerRef = useRef<any>(null)
  const drawStateRef = useRef({ counter: 0 })
  const previewNodeRef = useRef<any>(null)
  const manifestoRef = useRef<HTMLDivElement>(null)
  const manifestoRafRef = useRef<number>(0)

// Show manifesto only when code is the original default
  const isDefaultCode = code.startsWith('// 444 RADIO') && code.includes('setcps(72/60/4)')

  // Extract pattern name from first comment line for bounce filename
  const patternName = (() => {
    const firstLine = code.split('\n')[0] || ''
    const match = firstLine.match(/\/\/\s*(.+)/)
    if (match) return match[1].trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase()
    return 'untitled'
  })()

  // Slider state
  const sliderValuesRef = useRef<Record<string, number>>({})
  const sliderDefsRef = useRef<Record<string, { min: number; max: number; value: number }>>({})
  const [sliderDefs, setSliderDefs] = useState<Record<string, { min: number; max: number; value: number }>>({})

  // Master volume state (persisted in localStorage)
  const masterGainRef = useRef<GainNode | null>(null)
  const [masterVolume, setMasterVolume] = useState(0.75)

  // ─── Sound Uploader ───
  const [showSoundUploader, setShowSoundUploader] = useState(false)

  // ─── WAV Recording ───
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  // Undo/Redo history
  const undoStackRef = useRef<string[]>([])
  const redoStackRef = useRef<string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const isUndoRedoRef = useRef(false) // flag to skip pushing during undo/redo

  // Node view state
  const [showNodes, setShowNodes] = useState(false)
  const [showNodeAddMenu, setShowNodeAddMenu] = useState(false)
  const nodeEditorRef = useRef<NodeEditorHandle>(null)
  // Force re-render when NDE state changes (bpm, zoom, etc.)
  const [, forceNdeUpdate] = useState(0)
  const ndeTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // When showNodes is on, poll NDE state for header updates
  useEffect(() => {
    if (showNodes) {
      ndeTickRef.current = setInterval(() => forceNdeUpdate(c => c + 1), 200)
    } else {
      if (ndeTickRef.current) clearInterval(ndeTickRef.current)
    }
    return () => { if (ndeTickRef.current) clearInterval(ndeTickRef.current) }
  }, [showNodes])

  // Panel state
  const [activePanel, setActivePanel] = useState<'sounds' | 'examples' | 'settings' | 'learn' | 'patterns' | 'vibe'>('examples')
  const [activeFilter, setActiveFilter] = useState<SoundFilter>('samples')
  const [soundSearch, setSoundSearch] = useState('')
  const [allSounds, setAllSounds] = useState<Record<string, any>>({})
  const [showPanel, setShowPanel] = useState(true)
  const [showReleaseModal, setShowReleaseModal] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [exampleSearch, setExampleSearch] = useState('')
  const [selectedExample, setSelectedExample] = useState<{ code: string; label: string } | null>(null)

  // Metronome state
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const metronomeRafRef = useRef<number | null>(null)

  // Metronome — drift-free lookahead scheduler using Web Audio scheduled timing.
  // Schedules clicks ahead of time using audioContext.currentTime so they
  // are sample-accurate regardless of JS main-thread jitter.
  // Reads BPM dynamically each frame so tempo changes are picked up immediately.
  useEffect(() => {
    if (metronomeRafRef.current) { cancelAnimationFrame(metronomeRafRef.current); metronomeRafRef.current = null }
    if (!metronomeEnabled || !isPlaying) return

    const wa = webaudioRef.current
    if (!wa?.getAudioContext) return
    const ctx = wa.getAudioContext()
    if (ctx.state === 'suspended') return

    const lookahead = 0.08 // schedule 80ms ahead
    let nextBeatTime = ctx.currentTime + 0.02 // first click 20ms from now
    let beatIndex = 0
    let lastBpm = nodeEditorRef.current?.bpm || 72

    const scheduleClick = (time: number, downbeat: boolean) => {
      try {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = downbeat ? 1200 : 800
        gain.gain.setValueAtTime(downbeat ? 0.12 : 0.06, time)
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06)
        osc.start(time)
        osc.stop(time + 0.06)
      } catch { /* silent */ }
    }

    const tick = () => {
      // Re-read BPM each frame so tempo changes take effect immediately
      const currentBpm = nodeEditorRef.current?.bpm || 72
      if (currentBpm !== lastBpm) {
        // BPM changed — adjust nextBeatTime based on new tempo
        lastBpm = currentBpm
      }
      const secPerBeat = 60 / currentBpm
      const deadline = ctx.currentTime + lookahead
      while (nextBeatTime < deadline) {
        scheduleClick(nextBeatTime, beatIndex % 4 === 0)
        nextBeatTime += secPerBeat
        beatIndex++
      }
      metronomeRafRef.current = requestAnimationFrame(tick)
    }
    metronomeRafRef.current = requestAnimationFrame(tick)
    return () => { if (metronomeRafRef.current) cancelAnimationFrame(metronomeRafRef.current) }
  }, [metronomeEnabled, isPlaying]) // eslint-disable-line react-hooks/exhaustive-deps

  // Vibe chat state
  const [vibeMessages, setVibeMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([])
  const [vibeInput, setVibeInput] = useState('')
  const [vibeLoading, setVibeLoading] = useState(false)
  const vibeEndRef = useRef<HTMLDivElement>(null)
  const [vibeAudioFile, setVibeAudioFile] = useState<File | null>(null)
  const vibeAudioInputRef = useRef<HTMLInputElement>(null)

  // Patterns state
  const [savedPatterns, setSavedPatterns] = useState<SavedPattern[]>([])
  const [patternSearch, setPatternSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savePatternName, setSavePatternName] = useState('')
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Theme state (persisted in localStorage — deferred to avoid hydration mismatch)
  const [activeTheme, setActiveTheme] = useState<string>('444 Radio')

  // Editor settings (persisted in localStorage)
  const [editorFontSize, setEditorFontSize] = useState(14)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [highlightEvents, setHighlightEvents] = useState(true)
  const [lineWrapping, setLineWrapping] = useState(false)
  const [flashOnEval, setFlashOnEval] = useState(true)

  // Hydrate saved theme + patterns + editor settings from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('444-input-theme')
    if (saved && STRUDEL_THEMES[saved]) {
      setActiveTheme(saved)
    }
    // Hydrate master volume
    const savedVol = localStorage.getItem('444-master-volume')
    if (savedVol !== null) {
      const v = parseFloat(savedVol)
      if (!isNaN(v)) setMasterVolume(v)
    }
    // Hydrate editor settings
    const fs = localStorage.getItem('444-editor-font-size')
    if (fs) { const n = parseInt(fs); if (!isNaN(n) && n >= 10 && n <= 32) setEditorFontSize(n) }
    const ln = localStorage.getItem('444-editor-line-numbers')
    if (ln !== null) setShowLineNumbers(ln !== 'false')
    const he = localStorage.getItem('444-editor-highlight-events')
    if (he !== null) setHighlightEvents(he !== 'false')
    const lw = localStorage.getItem('444-editor-line-wrapping')
    if (lw !== null) setLineWrapping(lw === 'true')
    const fe = localStorage.getItem('444-editor-flash-eval')
    if (fe !== null) setFlashOnEval(fe !== 'false')
    // Hydrate saved patterns
    setSavedPatterns(loadPatternsFromStorage())
  }, [])

  // ─── Pattern management handlers ───
  const savePattern = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed || !code.trim()) return
    const now = Date.now()
    const newPattern: SavedPattern = {
      id: `pat_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
      code: code,
      createdAt: now,
      updatedAt: now,
    }
    setSavedPatterns(prev => {
      const updated = [newPattern, ...prev]
      savePatternsToStorage(updated)
      return updated
    })
    setSaveDialogOpen(false)
    setSavePatternName('')
  }, [code])

  const deletePattern = useCallback((id: string) => {
    setSavedPatterns(prev => {
      const updated = prev.filter(p => p.id !== id)
      savePatternsToStorage(updated)
      return updated
    })
  }, [])

  const renamePattern = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSavedPatterns(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name: trimmed, updatedAt: Date.now() } : p)
      savePatternsToStorage(updated)
      return updated
    })
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const updatePattern = useCallback((id: string) => {
    if (!code.trim()) return
    setSavedPatterns(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, code, updatedAt: Date.now() } : p)
      savePatternsToStorage(updated)
      return updated
    })
  }, [code])

  const duplicatePattern = useCallback((pat: SavedPattern) => {
    const now = Date.now()
    const dupe: SavedPattern = {
      id: `pat_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: `${pat.name} (copy)`,
      code: pat.code,
      createdAt: now,
      updatedAt: now,
    }
    setSavedPatterns(prev => {
      const idx = prev.findIndex(p => p.id === pat.id)
      const updated = [...prev]
      updated.splice(idx + 1, 0, dupe)
      savePatternsToStorage(updated)
      return updated
    })
  }, [])

  const newBlankPattern = useCallback(() => {
    const now = Date.now()
    const blank: SavedPattern = {
      id: `pat_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name: 'untitled',
      code: '// new pattern\nsound("bd sd hh cp")',
      createdAt: now,
      updatedAt: now,
    }
    setSavedPatterns(prev => {
      const updated = [blank, ...prev]
      savePatternsToStorage(updated)
      return updated
    })
  }, [])

  const deleteAllPatterns = useCallback(() => {
    setSavedPatterns([])
    savePatternsToStorage([])
    setConfirmDeleteAll(false)
  }, [])

  const exportPatterns = useCallback((patterns: SavedPattern[]) => {
    const data = JSON.stringify(patterns, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `444radio-patterns-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportSinglePattern = useCallback((pattern: SavedPattern) => {
    const data = JSON.stringify(pattern, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pattern.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importPatterns = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        // Handle both single pattern and array of patterns
        const incoming: SavedPattern[] = Array.isArray(parsed) ? parsed : [parsed]
        // Validate structure
        const valid = incoming.filter(p => p.id && p.name && p.code && p.createdAt)
        if (valid.length === 0) return
        setSavedPatterns(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          // Deduplicate by id, add new ones on top
          const newOnes = valid.filter(p => !existingIds.has(p.id))
          const updated = [...newOnes, ...prev]
          savePatternsToStorage(updated)
          return updated
        })
      } catch { /* invalid JSON */ }
    }
    reader.readAsText(file)
    // Reset input so same file can be re-imported
    e.target.value = ''
  }, [])

  const filteredPatterns = useMemo(() => {
    if (!patternSearch.trim()) return savedPatterns
    const q = patternSearch.toLowerCase()
    return savedPatterns.filter(p =>
      p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    )
  }, [savedPatterns, patternSearch])

  const themeColors = useMemo(() => STRUDEL_THEMES[activeTheme] || STRUDEL_THEMES['444 Radio'], [activeTheme])

  const applyTheme = useCallback((name: string) => {
    setActiveTheme(name)
    if (typeof window !== 'undefined') {
      localStorage.setItem('444-input-theme', name)
    }
  }, [])

  // ─── Editor setting updaters (persist to localStorage) ───
  const updateEditorFontSize = useCallback((size: number) => {
    setEditorFontSize(size)
    localStorage.setItem('444-editor-font-size', String(size))
  }, [])
  const updateShowLineNumbers = useCallback((v: boolean) => {
    setShowLineNumbers(v)
    localStorage.setItem('444-editor-line-numbers', String(v))
  }, [])
  const updateHighlightEvents = useCallback((v: boolean) => {
    setHighlightEvents(v)
    localStorage.setItem('444-editor-highlight-events', String(v))
  }, [])
  const updateLineWrapping = useCallback((v: boolean) => {
    setLineWrapping(v)
    localStorage.setItem('444-editor-line-wrapping', String(v))
  }, [])
  const updateFlashOnEval = useCallback((v: boolean) => {
    setFlashOnEval(v)
    localStorage.setItem('444-editor-flash-eval', String(v))
  }, [])

  // ─── Initialize Strudel engine + load ALL sounds + tonal ───
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        setLoadingMsg('importing modules...')

        const [core, webaudio, transpilerMod, mini] = await Promise.all([
          import('@strudel/core'),
          import('@strudel/webaudio'),
          import('@strudel/transpiler'),
          import('@strudel/mini'),
        ])

        if (cancelled) return

        // Expose soundMap for the panel
        soundMapRef.current = webaudio.soundMap
        webaudioRef.current = webaudio

        // Suppress noisy superdough deprecation warnings (node.onended)
        if ((webaudio as any).setLogger) {
          (webaudio as any).setLogger((...args: any[]) => {
            const msg = typeof args[0] === 'string' ? args[0] : ''
            if (msg.includes('Deprecation warning')) return
            console.log(...args)
          })
        }

        setLoadingMsg('initializing audio...')
        // Fire initAudioOnFirstClick but DON'T await it — it listens for a
        // document click to resume the AudioContext. Awaiting it blocks the
        // entire init chain and keeps the play button disabled/invisible.
        // The user's click on "play" will satisfy the listener.
        webaudio.initAudioOnFirstClick()

        // ─── PREBAKE: load all sounds (mirrors strudel.cc/prebake.mjs) ───
        setLoadingMsg('loading synths...')
        await webaudio.registerSynthSounds()
        await webaudio.registerZZFXSounds()

        setLoadingMsg('loading samples from CDN...')
        await Promise.all([
          webaudio.samples('github:tidalcycles/dirt-samples'),
          webaudio.samples(`${STRUDEL_CDN}/piano.json`, `${STRUDEL_CDN}/piano/`, { prebake: true }),
          webaudio.samples(`${STRUDEL_CDN}/vcsl.json`, `${STRUDEL_CDN}/VCSL/`, { prebake: true }),
          webaudio.samples(`${STRUDEL_CDN}/tidal-drum-machines.json`, `${STRUDEL_CDN}/tidal-drum-machines/machines/`, {
            prebake: true,
            tag: 'drum-machines',
          }),
          webaudio.samples(`${STRUDEL_CDN}/uzu-drumkit.json`, `${STRUDEL_CDN}/uzu-drumkit/`, {
            prebake: true,
            tag: 'drum-machines',
          }),
          webaudio.samples(`${STRUDEL_CDN}/uzu-wavetables.json`, `${STRUDEL_CDN}/uzu-wavetables/`, {
            prebake: true,
          }),
          webaudio.samples(`${STRUDEL_CDN}/mridangam.json`, `${STRUDEL_CDN}/mrid/`, {
            prebake: true,
            tag: 'drum-machines',
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

        // Drum machine aliases
        setLoadingMsg('loading aliases...')
        await webaudio.aliasBank(`${STRUDEL_CDN}/tidal-drum-machines-alias.json`)

        // Try loading soundfonts (GM instruments)
        setLoadingMsg('loading soundfonts...')
        try {
          const sf = await import('@strudel/soundfonts')
          await sf.registerSoundfonts()
          console.log('[444 INPUT] soundfonts registered successfully')
        } catch (sfErr) {
          console.warn('[444 INPUT] soundfonts registration failed:', sfErr)
        }

        // ─── Register @strudel/tonal (voicing, chord dicts, etc.) ───
        setLoadingMsg('loading tonal...')
        try {
          const tonal = await import('@strudel/tonal')
          if (typeof tonal.registerVoicings === 'function') {
            await tonal.registerVoicings()
          }
          console.log('[444 INPUT] @strudel/tonal loaded')
        } catch (err) {
          console.log('[444 INPUT] tonal not available, voicing() may not work:', err)
        }

        if (cancelled) return

        // ─── Register eval scope (including tonal + soundfonts for voicing/chord/GM support) ───
        setLoadingMsg('registering functions...')
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

        // ─── Inject sliderWithID using ref() for proper Pattern integration ───
        // Transpiler rewrites slider(val,min,max) → sliderWithID(id,val,min,max)
        // Must return a Pattern (via ref) so it composes with other patterns
        ;(globalThis as any).sliderWithID = (id: string, value: number, _min?: number, _max?: number) => {
          const min = _min ?? 0
          const max = _max ?? 1
          // Only set initial value if not already registered (preserves live-tweaked values)
          if (!(id in sliderValuesRef.current)) {
            sliderValuesRef.current[id] = value
          }
          // Register slider definition for UI
          sliderDefsRef.current[id] = { min, max, value: sliderValuesRef.current[id] }
          // Return a Pattern using ref() so it reads live value at query time
          return (core as any).ref(() => sliderValuesRef.current[id])
        }
        // Update slider defs state for UI rendering
        setSliderDefs({ ...sliderDefsRef.current })

        // Listen for slider value changes from CodeMirror compat
        if (typeof window !== 'undefined') {
          window.addEventListener('message', (e: MessageEvent) => {
            if (e.data?.type === 'cm-slider' && sliderValuesRef.current[e.data.id] !== undefined) {
              sliderValuesRef.current[e.data.id] = e.data.value
            }
          })
        }

        // ─── Create REPL evaluate function ───
        const replResult = core.repl({
          defaultOutput: webaudio.webaudioOutput,
          getTime: () => webaudio.getAudioContext().currentTime,
          transpiler: transpilerMod.transpiler,
        }) as any
        const { evaluate } = replResult
        const scheduler = replResult.scheduler

        strudelRef.current = { evaluate, webaudio, core, scheduler }

        // Multi-visual draw state is stored in drawStateRef (accessible from handlePlay/handleUpdate)

        // ─── Create Drawer for onPaint-based visualizations (scope, pianoroll, spiral, pitchwheel, punchcard, wordfall) ───
        // Supports MULTIPLE visuals on separate $: lines by compositing painters onto offscreen canvases
        try {
          // @ts-ignore
          const drawMod = await import('@strudel/draw')
          const drawTime = [-2, 2] // lookbehind, lookahead in cycles
          // Cache of offscreen canvases keyed by painter count — reused across frames
          let offscreenPool: OffscreenCanvas[] = []
          const drawer = new drawMod.Drawer(
            (haps: any[], time: number, _drawer: any, painters: any[]) => {
              const canvas = canvasRef.current
              if (!canvas) return
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (!ctx) return
              const w = canvas.width, h = canvas.height
              // Render all onPaint painters
              if (painters && painters.length > 0) {
                ctx.clearRect(0, 0, w, h)
                if (painters.length === 1) {
                  // Single painter — draw directly (fast path, no compositing overhead)
                  const origClear = ctx.clearRect.bind(ctx)
                  ctx.clearRect = () => {}
                  try { painters[0](ctx, time, haps, drawTime) } catch (e) {}
                  ctx.clearRect = origClear
                } else {
                  // Multiple painters — each draws to its own offscreen canvas, then composite
                  // Grow pool if needed
                  while (offscreenPool.length < painters.length) {
                    offscreenPool.push(new OffscreenCanvas(w, h))
                  }
                  painters.forEach((painter: any, i: number) => {
                    const osc = offscreenPool[i]
                    // Resize if main canvas changed
                    if (osc.width !== w || osc.height !== h) {
                      osc.width = w
                      osc.height = h
                    }
                    const octx = osc.getContext('2d', { willReadFrequently: true })
                    if (!octx) return
                    octx.clearRect(0, 0, w, h)
                    try { painter(octx, time, haps, drawTime) } catch (e) {}
                  })
                  // Composite: draw each offscreen canvas onto the main canvas
                  painters.forEach((_: any, i: number) => {
                    ctx.drawImage(offscreenPool[i], 0, 0)
                  })
                }
              }
              // Track active haps for status bar display + token highlighting
              const currentlyActive = haps
                .filter((h: any) => h.whole && h.whole.begin <= time && h.endClipped > time)
              // Sound names for status bar
              const soundNames = currentlyActive
                .map((h: any) => h.value?.s || h.value?.note || h.value?.sound || '')
                .filter(Boolean)
              const uniqueActive = [...new Set(soundNames)] as string[]
              const ref = activeHapsRef.current
              const changed = uniqueActive.length !== ref.size || uniqueActive.some(s => !ref.has(s))
              if (changed) {
                ref.clear()
                uniqueActive.forEach(s => ref.add(s))
              }
              // Collect character-level locations for token highlighting (Strudel-style outlines)
              const locs: {start: number, end: number}[] = []
              for (const hap of currentlyActive) {
                if (hap.context?.locations) {
                  for (const loc of hap.context.locations) {
                    const s = typeof loc.start === 'number' ? loc.start : (loc.start?.offset ?? loc.start)
                    const e = typeof loc.end === 'number' ? loc.end : (loc.end?.offset ?? loc.end)
                    if (typeof s === 'number' && typeof e === 'number') {
                      locs.push({ start: s, end: e })
                    }
                  }
                }
              }
              activeLocsRef.current = locs
            },
            drawTime,
          )
          drawerRef.current = drawer
          console.log('[444 INPUT] Drawer created for onPaint visualizations')

          // ─── Monkey-patch Pattern.prototype.draw to support MULTIPLE visualizations ───
          // Must run AFTER @strudel/draw import (which installs .draw() on Pattern.prototype)
          // In stock Strudel, .scope() / .pianoroll() / .fscope() all call .draw() with id=1
          // The second .draw(id=1) cancels the first one's rAF loop, so only the last visual works.
          // Fix: auto-assign unique IDs so each visual gets its own animation loop,
          // and suppress redundant canvas clears so they composite instead of overwriting.
          try {
            const PatternProto = (core as any).Pattern?.prototype
            if (PatternProto?.draw) {
              const _origDraw = PatternProto.draw
              PatternProto.draw = function (callback: any, options: any = {}) {
                drawStateRef.current.counter++
                const uniqueId = `vis_${drawStateRef.current.counter}`
                // Wrap the callback to suppress canvas clearing after the first clear per frame
                const wrappedCallback = (...cbArgs: any[]) => {
                  const canvas = canvasRef.current || document.querySelector('#test-canvas') as HTMLCanvasElement
                  if (canvas) {
                    const ctx = canvas.getContext('2d', { willReadFrequently: true })
                    if (ctx) {
                      const origClear = ctx.clearRect
                      const origFill = ctx.fillRect
                      const now = performance.now()
                      const lastClear = (canvas as any).__lastClearFrame || 0
                      if (now - lastClear > 2) {
                        // First visual this frame — allow clear, then stamp
                        ;(canvas as any).__lastClearFrame = now
                      } else {
                        // Subsequent visual in same frame — suppress clears so visuals composite
                        ctx.clearRect = () => {}
                        ctx.fillRect = function (x: number, y: number, w: number, h: number) {
                          if (x === 0 && y === 0 && w >= canvas.width * 0.9 && h >= canvas.height * 0.9) return
                          origFill.call(ctx, x, y, w, h)
                        } as any
                      }
                      try {
                        callback(...cbArgs)
                      } finally {
                        ctx.clearRect = origClear
                        ctx.fillRect = origFill
                      }
                      return
                    }
                  }
                  callback(...cbArgs)
                }
                return _origDraw.call(this, wrappedCallback, { ...options, id: uniqueId })
              }
              console.log('[444 INPUT] Patched Pattern.draw for multi-visual support')
            } else {
              console.warn('[444 INPUT] Pattern.prototype.draw not found after @strudel/draw import')
            }
          } catch (err) {
            console.warn('[444 INPUT] Multi-visual patch failed:', err)
          }
        } catch (err) {
          console.log('[444 INPUT] Drawer setup failed (onPaint visuals unavailable):', err)
        }

        // ─── Grab master GainNode from superdough for volume control ───
        try {
          const controller = (webaudio as any).getSuperdoughAudioController?.()
          if (controller?.output?.destinationGain) {
            masterGainRef.current = controller.output.destinationGain
            // Apply saved volume
            const savedVol = localStorage.getItem('444-master-volume')
            const vol = savedVol !== null ? parseFloat(savedVol) : 0.75
            if (!isNaN(vol)) masterGainRef.current!.gain.value = vol
            console.log('[444 INPUT] master volume connected')
          }
          // Pre-initialize orbits 0-11 so duck() always has valid targets
          if (controller?.getOrbit) {
            for (let i = 0; i < 12; i++) {
              controller.getOrbit(i)
            }
            console.log('[444 INPUT] pre-initialized 12 orbits for duck()')
          }
        } catch (err) {
          console.log('[444 INPUT] master gain not available:', err)
        }

        // ─── Audio analyser for reactive glow ───
        try {
          const ctx = webaudio.getAudioContext()
          if (ctx && !analyserRef.current) {
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 256
            analyser.smoothingTimeConstant = 0.8
            ctx.destination // connect analyser to listen to output
            // Connect to destination via a splitter if available
            if (masterGainRef.current) {
              masterGainRef.current.connect(analyser)
            } else {
              // Fallback: create a gain node tap
              const tap = ctx.createGain()
              tap.gain.value = 1
              tap.connect(ctx.destination)
              tap.connect(analyser)
            }
            analyserRef.current = analyser
            console.log('[444 INPUT] audio analyser connected for reactive glow')
          }
        } catch (err) {
          console.log('[444 INPUT] analyser setup failed:', err)
        }

        // ─── Populate sounds panel from soundMap ───
        updateSoundsPanel()

        // Subscribe to soundMap changes
        if (webaudio.soundMap?.subscribe) {
          webaudio.soundMap.subscribe(() => {
            if (!cancelled) updateSoundsPanel()
          })
        }

        // ─── Load user's custom NDE samples ───
        try {
          const samplesRes = await fetch('/api/nde/samples')
          if (samplesRes.ok) {
            const samplesData = await samplesRes.json()
            if (samplesData.samples?.length > 0) {
              for (const s of samplesData.samples) {
                try {
                  await webaudio.samples({ [s.name]: [s.url] })
                } catch (regErr) {
                  console.warn(`[444 INPUT] Failed to register custom sample "${s.name}":`, regErr)
                }
              }
              console.log(`🎵 [444 INPUT] Loaded ${samplesData.samples.length} custom NDE samples`)
            }
          }
        } catch (customErr) {
          console.warn('[444 INPUT] Failed to load custom samples:', customErr)
        }

        setStatus('ready')
        setLoadingMsg('')
        setError(null)
        console.log('🌀 444 INPUT ready — all sounds + tonal loaded 🌀')
      } catch (err: any) {
        if (cancelled) return
        console.error('Init failed:', err)
        setError(`Init failed: ${err.message}`)
        setStatus('error')
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Read all sounds from the soundMap store
  const updateSoundsPanel = useCallback(() => {
    if (!soundMapRef.current?.get) return
    const map = soundMapRef.current.get()
    if (map) setAllSounds({ ...map })
  }, [])

  // ─── Filter + sort sounds for active tab ───
  const filteredSounds = useMemo(() => {
    const entries: SoundEntry[] = []
    for (const [name, value] of Object.entries(allSounds)) {
      if (name.startsWith('_')) continue
      const data = (value as any)?.data || {}
      const type = data.type || 'unknown'
      const tag = data.tag || ''
      let count = 1
      if (type === 'sample' && data.samples) {
        count = Array.isArray(data.samples) ? data.samples.length : Object.values(data.samples).length
      } else if (type === 'wavetable' && data.tables) {
        count = Array.isArray(data.tables) ? data.tables.length : Object.values(data.tables).length
      } else if (type === 'soundfont' && data.fonts) {
        count = data.fonts.length
      }
      entries.push({ name, count, type, tag })
    }

    let filtered = entries
    switch (activeFilter) {
      case 'samples':
        filtered = entries.filter(e => e.type === 'sample' && e.tag !== 'drum-machines')
        break
      case 'drum-machines':
        filtered = entries.filter(e => e.type === 'sample' && e.tag === 'drum-machines')
        break
      case 'synths':
        filtered = entries.filter(e => ['synth', 'soundfont'].includes(e.type))
        break
      case 'wavetables':
        filtered = entries.filter(e => e.type === 'wavetable')
        break
    }

    if (soundSearch) {
      filtered = filtered.filter(e => e.name.toLowerCase().includes(soundSearch.toLowerCase()))
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name))
  }, [allSounds, activeFilter, soundSearch])

  // ─── Auto-correct hallucinated GM soundfont names before evaluation ───
  const fixSoundfontNames = useCallback((src: string): string => {
    const fixes: [RegExp, string][] = [
      // Guitar (longest first)
      [/\bgm_nylon_guitar\b/g, 'gm_acoustic_guitar_nylon'],
      [/\bgm_steel_guitar\b/g, 'gm_acoustic_guitar_steel'],
      [/\bgm_clean_guitar\b/g, 'gm_electric_guitar_clean'],
      [/\bgm_guitar_clean\b/g, 'gm_electric_guitar_clean'],
      [/\bgm_jazz_guitar\b/g, 'gm_electric_guitar_jazz'],
      [/\bgm_muted_guitar\b/g, 'gm_electric_guitar_muted'],
      [/\bgm_acoustic_guitar\b(?!_)/g, 'gm_acoustic_guitar_nylon'],
      [/\bgm_electric_guitar\b(?!_)/g, 'gm_electric_guitar_clean'],
      [/\bgm_guitar\b(?!_)/g, 'gm_acoustic_guitar_nylon'],
      [/\bgm_nylon\b/g, 'gm_acoustic_guitar_nylon'],
      [/\bgm_steel\b/g, 'gm_acoustic_guitar_steel'],
      // Bass
      [/\bgm_fingered_bass\b/g, 'gm_electric_bass_finger'],
      [/\bgm_finger_bass\b/g, 'gm_electric_bass_finger'],
      [/\bgm_picked_bass\b/g, 'gm_electric_bass_pick'],
      [/\bgm_pick_bass\b/g, 'gm_electric_bass_pick'],
      [/\bgm_slap_bass1\b/g, 'gm_slap_bass_1'],
      [/\bgm_slap_bass2\b/g, 'gm_slap_bass_2'],
      [/\bgm_synth_bass1\b/g, 'gm_synth_bass_1'],
      [/\bgm_synth_bass2\b/g, 'gm_synth_bass_2'],
      // Organ
      [/\bgm_organ1\b/g, 'gm_drawbar_organ'],
      [/\bgm_organ2\b/g, 'gm_percussive_organ'],
      [/\bgm_organ\b(?!_)/g, 'gm_drawbar_organ'],
      // Brass
      [/\bgm_brass1\b/g, 'gm_brass_section'],
      [/\bgm_brass2\b/g, 'gm_synth_brass_1'],
      [/\bgm_brass\b(?!_)/g, 'gm_brass_section'],
      // Strings
      [/\bgm_pizzicato\b(?!_)/g, 'gm_pizzicato_strings'],
      [/\bgm_strings1\b/g, 'gm_string_ensemble_1'],
      [/\bgm_strings2\b/g, 'gm_string_ensemble_2'],
      [/\bgm_strings\b(?!_)/g, 'gm_string_ensemble_1'],
      // Vocal
      [/\bgm_synth_voice\b/g, 'gm_synth_choir'],
      [/\bgm_voice\b(?!_)/g, 'gm_voice_oohs'],
      [/\bgm_choir\b(?!_)/g, 'gm_choir_aahs'],
      // Piano
      [/\bgm_electric_piano1\b/g, 'gm_epiano1'],
      [/\bgm_electric_piano2\b/g, 'gm_epiano2'],
      [/\bgm_electric_piano\b(?![\d_])/g, 'gm_epiano1'],
      // Harp
      [/\bgm_harp\b(?!_)/g, 'gm_orchestral_harp'],
      // Flute
      [/\bgm_flute_ensemble\b/g, 'gm_flute'],
      // Bare abbreviated names
      [/\bgm_synth\b(?!_)/g, 'gm_synth_strings_1'],
      [/\bgm_pad\b(?!_)/g, 'gm_pad_warm'],
      [/\bgm_lead\b(?!_)/g, 'gm_lead_2_sawtooth'],
    ]
    let fixed = src
    for (const [pattern, replacement] of fixes) {
      fixed = fixed.replace(pattern, replacement)
    }

    // Strip hallucinated method calls that don't exist in Strudel
    // Handles nested parens up to 2 levels deep: .glide(sine.range(0,1))
    const fakeMethods = 'glide|portamento|slide|legato_time|bend|sweep|morph|vibdepth|vibrate|vibrato|freq|tone|bpm|tempo|instrument|detune|spread|width|mix'
    const fakeMethodsPattern = new RegExp(`\\.(${fakeMethods})\\((?:[^()]*|\\([^()]*\\))*\\)`, 'g')
    fixed = fixed.replace(fakeMethodsPattern, '')

    return fixed
  }, [])

  // ─── Play / Stop / Update ───
  const handlePlay = useCallback(async () => {
    if (!strudelRef.current?.evaluate) {
      setError('Engine not ready')
      return
    }
    try {
      if (isPlaying) {
        // STOP: evaluate silence + clean up draw
        await strudelRef.current.evaluate('silence')
        try {
          // @ts-ignore
          const { cleanupDraw } = await import('@strudel/draw')
          cleanupDraw(true)
        } catch {}
        // Stop Drawer animation loop
        if (drawerRef.current) {
          try { drawerRef.current.stop() } catch {}
        }
        setIsPlaying(false)
        setStatus('ready')
        setError(null)
      } else {
        setError(null)
        const src = codeRef.current.trim()
        if (!src || src.split('\n').every((l: string) => l.trim().startsWith('//'))) {
          throw new Error('Enter a pattern to play')
        }
        // Reset slider defs before evaluation (they get re-registered by sliderWithID calls)
        sliderDefsRef.current = {}
        const { evaluate, webaudio } = strudelRef.current
        await webaudio.getAudioContext().resume()
        drawStateRef.current.counter = 0  // Reset draw IDs for fresh evaluation
        lastEvaluatedRef.current = '' // Clear dedup so live updates evaluate immediately
        await evaluate(fixSoundfontNames(src))
        setSliderDefs({ ...sliderDefsRef.current })
        // Start Drawer for onPaint visualizations + active hap tracking
        if (drawerRef.current && strudelRef.current?.scheduler) {
          try {
            const scheduler = strudelRef.current.scheduler
            // Check if pattern uses onPaint painters — if so, use full draw window
            // Always use at least [-0.1, 0.1] so active hap tracking works for line highlighting
            const hasPainters = scheduler.pattern?.getPainters?.()?.length > 0
            drawerRef.current.setDrawTime(hasPainters ? [-2, 2] : [-0.1, 0.1])
            drawerRef.current.start(scheduler)
          } catch (e) { console.warn('[444 INPUT] Drawer start failed:', e) }
        }
        setIsPlaying(true)
        setStatus('playing')
      }
    } catch (err: any) {
      console.error('Play error:', err)
      setError(err.message || 'Playback failed')
      setStatus('error')
      setIsPlaying(false)
    }
  }, [isPlaying, fixSoundfontNames])

  // Update: re-evaluate code WITHOUT stopping — code changes take effect live
  const handleUpdate = useCallback(async (force?: boolean) => {
    if (!strudelRef.current?.evaluate || !isPlayingRef.current) return
    try {
      setError(null)
      const src = codeRef.current.trim()
      if (!src) return
      // Skip if code hasn't changed since last evaluate (prevents redundant hush+re-register
      // when both immediate and normal timers fire for the same code change).
      // Solo/mute passes force=true to bypass this check.
      if (!force && src === lastEvaluatedRef.current) return
      lastEvaluatedRef.current = src
      // Flash effect on evaluation
      if (flashOnEval && editorContainerRef.current) {
        editorContainerRef.current.style.outline = '2px solid rgba(34,211,238,0.4)'
        setTimeout(() => { if (editorContainerRef.current) editorContainerRef.current.style.outline = 'none' }, 200)
      }
      sliderDefsRef.current = {}
      const { evaluate, webaudio, scheduler } = strudelRef.current as any
      await webaudio.getAudioContext().resume()
      drawStateRef.current.counter = 0  // Reset draw IDs for fresh evaluation
      await evaluate(fixSoundfontNames(src))
      // Force immediate re-sync: restart scheduler clock so new pattern triggers instantly
      // Delayed slightly to allow Strudel time to load any newly-needed samples
      if (scheduler?.clock) {
        setTimeout(() => {
          try {
            scheduler.clock.pause()
            scheduler.clock.start()
          } catch (e) { /* sounds still loading — clock will catch up naturally */ }
        }, 100)
      }
      // Invalidate Drawer so onPaint painters are re-collected from new pattern
      if (drawerRef.current && scheduler) {
        try {
          const hasPainters = scheduler.pattern?.getPainters?.()?.length > 0
          drawerRef.current.setDrawTime(hasPainters ? [-2, 2] : [-0.1, 0.1])
          drawerRef.current.invalidate(scheduler)
        } catch (e) { console.warn('[444 INPUT] Drawer invalidate failed:', e) }
      }
      setSliderDefs({ ...sliderDefsRef.current })
    } catch (err: any) {
      console.error('Update error:', err)
      setError(err.message || 'Update failed')
    }
  }, [fixSoundfontNames, flashOnEval])

  // Keep handleUpdateRef always fresh
  handleUpdateRef.current = handleUpdate

  const handleStop = useCallback(async () => {
    // Auto-stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (strudelRef.current?.evaluate) {
      try { await strudelRef.current.evaluate('silence') } catch { /* ignore */ }
    }
    // Clean up draw visualizations
    try {
      // @ts-ignore
      const { cleanupDraw } = await import('@strudel/draw')
      cleanupDraw(true)
    } catch {}
    // Stop Drawer animation loop
    if (drawerRef.current) {
      try { drawerRef.current.stop() } catch {}
    }
    setIsPlaying(false)
    setStatus('ready')
    setError(null)
  }, [])

  // ─── Register custom sound in Strudel engine ───
  const registerCustomSound = useCallback(async (name: string, urls: string[]) => {
    const webaudio = webaudioRef.current
    if (!webaudio?.samples) {
      console.warn('[444 INPUT] Strudel webaudio not ready for custom sound registration')
      return
    }
    // Register as a named sample bank: { name: [url1, url2, ...] }
    await webaudio.samples({ [name]: urls })
    console.log(`🎵 [444 INPUT] Custom sound registered: "${name}" (${urls.length} file${urls.length > 1 ? 's' : ''})`)
  }, [])

  // ─── Per-node analyser lookup (from superdough's analysers map) ───
  const getAnalyserByIdCb = useCallback((id: string, fftSize = 256, smoothing = 0.8): AnalyserNode | null => {
    const webaudio = webaudioRef.current
    if (!webaudio?.getAnalyserById) return null
    try { return webaudio.getAnalyserById(id, fftSize, smoothing) } catch { return null }
  }, [])

  /** Get current cycle position from Strudel scheduler — used by NodeEditor to sync playhead/timeline/pianoroll */
  const getCyclePosition = useCallback((): number => {
    const scheduler = strudelRef.current?.scheduler
    if (scheduler?.now) return scheduler.now()
    return 0
  }, [])

  // ─── WAV Recording handler ───
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      return
    }

    // Start recording — need audio context
    const webaudio = webaudioRef.current
    if (!webaudio) { console.warn('[444 INPUT] No webaudio for recording'); return }
    const ctx = webaudio.getAudioContext()
    if (!ctx) { console.warn('[444 INPUT] No AudioContext for recording'); return }

    try {
      // Create a MediaStream destination if not already
      if (!streamDestRef.current) {
        const dest = ctx.createMediaStreamDestination()
        streamDestRef.current = dest
        // Connect master gain (or analyser source) to the stream destination
        if (masterGainRef.current) {
          masterGainRef.current.connect(dest)
        } else if (analyserRef.current) {
          // Fallback: create a tap from destination
          const tap = ctx.createGain()
          tap.gain.value = 1
          tap.connect(dest)
          tap.connect(ctx.destination)
        }
      }

      const streamDest = streamDestRef.current
      if (!streamDest) { console.warn('[444 INPUT] Stream destination not available'); return }

      recordedChunksRef.current = []
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const recorder = new MediaRecorder(streamDest.stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null }
        setRecordingTime(0)

        if (recordedChunksRef.current.length === 0) return

        // Convert to WAV
        const webmBlob = new Blob(recordedChunksRef.current, { type: mimeType })
        try {
          const wavBlob = await convertToWav(webmBlob, ctx.sampleRate)
          const url = URL.createObjectURL(wavBlob)
          const a = document.createElement('a')
          a.href = url
          const name = codeRef.current.split('\n')[0]?.match(/\/\/\s*(.+)/)?.[1]?.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'untitled'
          a.download = `444-${name}.wav`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 5000)
          console.log('[444 INPUT] WAV bounced successfully')
        } catch (err) {
          console.error('[444 INPUT] WAV conversion failed:', err)
          // Fallback: download as webm
          const url = URL.createObjectURL(webmBlob)
          const a = document.createElement('a')
          a.href = url
          const name2 = codeRef.current.split('\n')[0]?.match(/\/\/\s*(.+)/)?.[1]?.trim().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase() || 'untitled'
          a.download = `444-${name2}.webm`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          setTimeout(() => URL.revokeObjectURL(url), 5000)
        }
      }

      recorder.start(100) // collect data every 100ms
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordingTime(0)

      // Timer for display
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)

      console.log('[444 INPUT] Recording started')
    } catch (err) {
      console.error('[444 INPUT] Failed to start recording:', err)
    }
  }, [isRecording])

  // ─── Convert WebM/Ogg blob to WAV ───
  const convertToWav = useCallback(async (blob: Blob, sampleRate: number): Promise<Blob> => {
    const arrayBuffer = await blob.arrayBuffer()
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate })
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    await audioCtx.close()

    const numChannels = audioBuffer.numberOfChannels
    const length = audioBuffer.length
    const wavSampleRate = audioBuffer.sampleRate
    const bytesPerSample = 2 // 16-bit
    const blockAlign = numChannels * bytesPerSample
    const dataSize = length * blockAlign
    const headerSize = 44
    const buffer = new ArrayBuffer(headerSize + dataSize)
    const view = new DataView(buffer)

    // WAV header
    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true) // PCM chunk size
    view.setUint16(20, 1, true)  // PCM format
    view.setUint16(22, numChannels, true)
    view.setUint32(24, wavSampleRate, true)
    view.setUint32(28, wavSampleRate * blockAlign, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, 16, true) // bits per sample
    writeStr(36, 'data')
    view.setUint32(40, dataSize, true)

    // Interleave channels and write 16-bit PCM
    const channels: Float32Array[] = []
    for (let c = 0; c < numChannels; c++) channels.push(audioBuffer.getChannelData(c))

    let offset = headerSize
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
        offset += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }, [])

  // ─── Undo / Redo ───
  // Push current code to undo stack before any change
  const pushUndo = useCallback((prevCode: string) => {
    undoStackRef.current.push(prevCode)
    // Cap at 100 entries
    if (undoStackRef.current.length > 100) undoStackRef.current.shift()
    redoStackRef.current = [] // clear redo on new edit
    setCanUndo(true)
    setCanRedo(false)
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const prev = undoStackRef.current.pop()!
    redoStackRef.current.push(code)
    isUndoRedoRef.current = true
    setCode(prev)
    setCanUndo(undoStackRef.current.length > 0)
    setCanRedo(true)
    if (textareaRef.current) textareaRef.current.focus()
  }, [code])

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return
    const next = redoStackRef.current.pop()!
    undoStackRef.current.push(code)
    isUndoRedoRef.current = true
    setCode(next)
    setCanRedo(redoStackRef.current.length > 0)
    setCanUndo(true)
    if (textareaRef.current) textareaRef.current.focus()
  }, [code])

  // Wrapper: set code with undo tracking
  const setCodeWithUndo = useCallback((newCode: string | ((prev: string) => string)) => {
    setCode(prev => {
      const resolved = typeof newCode === 'function' ? newCode(prev) : newCode
      if (resolved !== prev) pushUndo(prev)
      return resolved
    })
  }, [pushUndo])

  // Stable callback for NodeEditor code changes — memoized to prevent
  // sendToParent/toggleSolo from being recreated on every InputEditor render.
  // When immediate=true (solo/mute), evaluates Strudel DIRECTLY — no ref chain,
  // no handleUpdate indirection, no stale closures that can silently abort.
  const handleNodeCodeChange = useCallback((newCode: string, immediate?: boolean) => {
    codeRef.current = newCode  // sync ref immediately
    lastEvaluatedRef.current = '' // Clear dedup — solo/mute MUST re-evaluate
    setCodeWithUndo(newCode)
    if (immediate) {
      // ── DIRECT Strudel evaluation for solo/mute ──
      // Bypasses handleUpdate entirely — that function's isPlayingRef guard
      // and async ref chain create timing windows that can silently skip evaluation.
      const strudel = strudelRef.current
      if (strudel?.evaluate && isPlayingRef.current) {
        const src = fixSoundfontNames(newCode.trim())
        ;(async () => {
          try {
            sliderDefsRef.current = {}
            await strudel.webaudio.getAudioContext().resume()
            drawStateRef.current.counter = 0
            await strudel.evaluate(src)
            lastEvaluatedRef.current = newCode.trim()
            // NOTE: Do NOT restart scheduler clock here. Solo/mute only changes
            // which $: blocks are commented out — evaluate() handles that.
            // Clock restart forces immediate playback before sounds are loaded,
            // causing "sound X not found! Is it loaded?" errors.
            // Re-sync Drawer painters
            if (drawerRef.current && strudel.scheduler) {
              try {
                const hasPainters = strudel.scheduler.pattern?.getPainters?.()?.length > 0
                drawerRef.current.setDrawTime(hasPainters ? [-2, 2] : [-0.1, 0.1])
                drawerRef.current.invalidate(strudel.scheduler)
              } catch {}
            }
            setSliderDefs({ ...sliderDefsRef.current })
          } catch (err: any) {
            console.error('[444 SOLO/MUTE] evaluate error:', err)
          }
        })()
      }
    }
  }, [setCodeWithUndo, fixSoundfontNames])  // fixSoundfontNames has deps=[] so this stays stable

  // Stable callback for NodeEditor evaluate trigger (debounced path)
  const handleNodeUpdate = useCallback(() => handleUpdateRef.current(), [])

  // Pattern loader (defined after setCodeWithUndo)
  const loadPattern = useCallback((patternCode: string) => {
    setCodeWithUndo(fixSoundfontNames(patternCode))
    if (textareaRef.current) textareaRef.current.focus()
  }, [setCodeWithUndo, fixSoundfontNames])

  // ─── Keyboard shortcuts ───
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ctrl+Space = toggle play/pause
    if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
      e.preventDefault()
      handlePlay()
    }
    // Ctrl+Enter = toggle play/pause (legacy)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handlePlay()
    }
    // Ctrl+. = live update
    if ((e.ctrlKey || e.metaKey) && e.key === '.') {
      e.preventDefault()
      handleUpdate()
    }
    // Undo: Ctrl+Z
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      handleUndo()
      return
    }
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault()
      handleRedo()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRef.current
      if (!ta) return
      const s = ta.selectionStart
      const end = ta.selectionEnd
      const next = code.substring(0, s) + '  ' + code.substring(end)
      setCodeWithUndo(next)
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + 2 }, 0)
    }
  }, [code, handlePlay, handleUpdate, handleStop, handleUndo, handleRedo, setCodeWithUndo])

  // ─── Global keyboard shortcuts (spacebar / period when textarea not focused) ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement
      const isTextInput = active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement || (active as HTMLElement)?.isContentEditable
      if (isTextInput) return

      if (e.key === ' ') {
        e.preventDefault()
        handlePlay()
      }
      if (e.key === '.') {
        e.preventDefault()
        handleUpdate()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [handlePlay, handleUpdate])

  // Insert a sound name into the editor at cursor
  const insertSound = useCallback((name: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const s = ta.selectionStart
    const insert = `"${name}"`
    setCodeWithUndo(prev => prev.substring(0, s) + insert + prev.substring(s))
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = s + insert.length
    }, 0)
  }, [setCodeWithUndo])

  // Load example into editor
  const loadExample = useCallback((exampleCode: string) => {
    setCodeWithUndo(fixSoundfontNames(exampleCode))
    if (textareaRef.current) textareaRef.current.focus()
  }, [setCodeWithUndo, fixSoundfontNames])

  // Append a visual modifier (like .scope()) to the end of the current cursor line
  const appendToLine = useCallback((modifier: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart
    // Find the end of the current line
    let lineEnd = code.indexOf('\n', pos)
    if (lineEnd === -1) lineEnd = code.length
    // Insert the modifier at the end of the current line
    const before = code.substring(0, lineEnd)
    const after = code.substring(lineEnd)
    const newCode = before + modifier + after
    setCodeWithUndo(newCode)
    setTimeout(() => {
      ta.focus()
      const newPos = lineEnd + modifier.length
      ta.selectionStart = ta.selectionEnd = newPos
    }, 0)
  }, [code, setCodeWithUndo])

  // Add example to existing editor code (append at cursor or end)
  const addExample = useCallback((exampleCode: string) => {
    const cleaned = fixSoundfontNames(exampleCode)
    const ta = textareaRef.current
    if (ta) {
      const pos = ta.selectionStart
      const before = code.substring(0, pos)
      const after = code.substring(pos)
      // Add separator newlines for readability
      const separator = before.length > 0 && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
      const newCode = before + separator + cleaned + after
      setCodeWithUndo(newCode)
      setTimeout(() => {
        ta.focus()
        const newPos = pos + separator.length + cleaned.length
        ta.selectionStart = ta.selectionEnd = newPos
      }, 0)
    } else {
      // Fallback: append to end
      setCodeWithUndo(prev => prev + '\n\n' + cleaned)
    }
  }, [code, setCodeWithUndo, fixSoundfontNames])

  // Copy example to clipboard
  const copyExample = useCallback((key: string, exampleCode: string) => {
    navigator.clipboard.writeText(exampleCode).catch(() => {})
    setCopiedIndex(key)
    setTimeout(() => setCopiedIndex(null), 1500)
  }, [])

  // Preview a sound on click — triggers directly via soundMap for instant playback
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewSound = useCallback(async (name: string, data: any) => {
    if (!strudelRef.current?.webaudio || !soundMapRef.current?.get) return
    const { webaudio } = strudelRef.current
    try {
      // Stop previous preview if still playing
      if (previewNodeRef.current) {
        try { previewNodeRef.current.disconnect() } catch {}
        previewNodeRef.current = null
      }
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)

      const ctx = webaudio.getAudioContext()
      await ctx.resume()

      // Read sound entry directly from the soundMap store (not from React state)
      const map = soundMapRef.current.get()
      const soundEntry = map?.[name]
      if (!soundEntry?.onTrigger) {
        console.warn('[preview] no onTrigger for', name)
        return
      }

      const params: any = {
        s: name,
        n: 0,
        clip: 1,
        release: 0.3,
        sustain: 0.8,
        duration: 0.5,
      }
      if (['synth', 'soundfont'].includes(data.type)) {
        params.note = 'a3'
      }

      // Trigger immediately (no delay)
      const time = ctx.currentTime
      const result = await soundEntry.onTrigger(time, params, () => {})
      if (result?.node) {
        webaudio.connectToDestination(result.node)
        previewNodeRef.current = result.node
        // Auto-disconnect preview after duration (doesn't affect main playback)
        previewTimeoutRef.current = setTimeout(() => {
          try { result.node?.disconnect() } catch {}
          previewNodeRef.current = null
        }, 800)
      }
    } catch (err) {
      console.warn('Preview failed:', err)
    }
  }, [])

  // Update slider value from UI
  const updateSliderValue = useCallback((id: string, value: number) => {
    sliderValuesRef.current[id] = value
    setSliderDefs(prev => ({ ...prev, [id]: { ...prev[id], value } }))
  }, [])

  // Update master volume — controls destinationGain of superdough output
  const updateMasterVolume = useCallback((value: number) => {
    setMasterVolume(value)
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = value
    }
    localStorage.setItem('444-master-volume', String(value))
  }, [])

  // Resize canvas to match editor container
  useEffect(() => {
    const container = editorContainerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
    }
    resizeCanvas()

    const observer = new ResizeObserver(resizeCanvas)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Cleanup draw canvas on unmount
  useEffect(() => {
    return () => {
      // @ts-ignore
      import('@strudel/draw').then(({ cleanupDraw }: any) => {
        cleanupDraw(true)
      }).catch(() => {})
    }
  }, [])

  const lineCount = code.split('\n').length

  // Map slider IDs (slider_<charOffset>) to line numbers + value column positions
  // charOffset from transpiler = position of the VALUE (first arg), not the "slider" keyword
  const slidersByLine = useMemo(() => {
    const lines = code.split('\n')
    const map: Record<number, { id: string; def: { min: number; max: number; value: number }; sliderStart: number; valueCol: number; valueLen: number }[]> = {}
    for (const [id, def] of Object.entries(sliderDefs)) {
      const match = id.match(/^slider_(\d+)$/)
      if (!match) continue
      const charOffset = parseInt(match[1], 10)
      let line = 0
      let lastNewline = -1
      for (let i = 0; i < charOffset && i < code.length; i++) {
        if (code[i] === '\n') { line++; lastNewline = i }
      }
      const valueCol = charOffset - lastNewline - 1 // column of the value inside slider()
      const sliderStart = valueCol - 7 // "slider(" = 7 chars before value
      const lineText = lines[line] ?? ''
      // Find closing paren for value end
      let valueEnd = valueCol
      while (valueEnd < lineText.length && lineText[valueEnd] !== ')') valueEnd++
      if (!map[line]) map[line] = []
      map[line].push({ id, def, sliderStart: Math.max(0, sliderStart), valueCol, valueLen: valueEnd - valueCol })
    }
    for (const line of Object.keys(map)) {
      map[Number(line)].sort((a, b) => a.sliderStart - b.sliderStart)
    }
    return map
  }, [sliderDefs, code])

  // Build display lines with slider widgets replacing slider(value) text
  const hasSliders = Object.keys(slidersByLine).length > 0
  const codeLines = code.split('\n')
  const renderCodeLine = useCallback((lineIdx: number) => {
    const lineText = codeLines[lineIdx] ?? ''
    const lineSliders = slidersByLine[lineIdx]
    if (!lineSliders || lineSliders.length === 0) {
      return <span>{lineText || '\u200B'}</span>
    }
    // Build segments: text, "slider(", [slider widget + value], ")", text...
    const segments: React.ReactNode[] = []
    let cursor = 0
    for (const { id, def, sliderStart, valueCol, valueLen } of lineSliders) {
      // Text before "slider("
      if (sliderStart > cursor) {
        segments.push(<span key={`t${cursor}`}>{lineText.slice(cursor, sliderStart)}</span>)
      }
      // "slider(" prefix text from original code
      segments.push(<span key={`s${sliderStart}`}>{lineText.slice(sliderStart, valueCol)}</span>)
      // Inline slider widget replacing the value text
      segments.push(
        <span key={id} className="inline-flex items-center pointer-events-auto" style={{ verticalAlign: 'middle' }}>
          <input
            type="range"
            min={def.min}
            max={def.max}
            step={(def.max - def.min) / 200}
            value={def.value}
            onChange={(e) => updateSliderValue(id, parseFloat(e.target.value))}
            className="cursor-pointer"
            style={{ width: '48px', height: '14px', margin: '0 2px', accentColor: '#22d3ee', verticalAlign: 'middle' }}
            title={`${def.value.toFixed(3)}`}
          />
          <span className="text-cyan-300 tabular-nums">{def.value.toFixed(3)}</span>
        </span>
      )
      // Skip past value text in original, include closing ")"
      cursor = valueCol + valueLen
      if (cursor < lineText.length && lineText[cursor] === ')') {
        segments.push(<span key={`c${cursor}`}>{')'}</span>)
        cursor++
      }
    }
    // Remaining text after last slider
    if (cursor < lineText.length) {
      segments.push(<span key={`e${cursor}`}>{lineText.slice(cursor)}</span>)
    }
    return <>{segments}</>
  }, [codeLines, slidersByLine, updateSliderValue])

  // ═══ VIBE CHAT HANDLER ═══
  const sendVibeMessage = useCallback(async () => {
    const msg = vibeInput.trim()
    if ((!msg && !vibeAudioFile) || vibeLoading) return
    const audioFile = vibeAudioFile
    setVibeInput('')
    setVibeAudioFile(null)
    const displayMsg = msg + (audioFile ? ` [audio: ${audioFile.name}]` : '')
    setVibeMessages(prev => [...prev, { role: 'user', text: displayMsg }])
    setVibeLoading(true)
    try {
      // If audio file attached, upload to R2 first to get a public URL
      let audioUrl: string | undefined
      if (audioFile) {
        const formData = new FormData()
        formData.append('file', audioFile)
        const uploadRes = await fetch('/api/upload/media', {
          method: 'POST',
          body: formData,
        })
        const uploadData = await uploadRes.json()
        if (uploadData.url) {
          audioUrl = uploadData.url
        } else {
          setVibeMessages(prev => [...prev, { role: 'ai', text: '// error: audio upload failed' }])
          setVibeLoading(false)
          return
        }
      }

      const res = await fetch('/api/generate/strudel-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg || 'Analyse this audio and generate a matching Strudel pattern', audioUrl }),
      })
      const data = await res.json()
      if (data.success && data.code) {
        setVibeMessages(prev => [...prev, { role: 'ai', text: data.code }])
      } else {
        setVibeMessages(prev => [...prev, { role: 'ai', text: `// error: ${data.error || 'generation failed'}` }])
      }
    } catch {
      setVibeMessages(prev => [...prev, { role: 'ai', text: '// error: network request failed' }])
    } finally {
      setVibeLoading(false)
    }
  }, [vibeInput, vibeLoading, vibeAudioFile])

  // Auto-scroll vibe chat
  useEffect(() => {
    vibeEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [vibeMessages])

  // ─── Audio-reactive glow animation loop ───
  useEffect(() => {
    if (!isPlaying) {
      // Reset glow when stopped
      if (glowRef.current) {
        glowRef.current.style.opacity = '0'
      }
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current)
      setActiveHaps([])
      setHighlightRanges([])
      activeLocsRef.current = []
      return
    }

    const dataArray = new Uint8Array(128)
    const animate = () => {
      if (analyserRef.current && glowRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray)
        // Average amplitude
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
        const avg = sum / dataArray.length / 255 // 0-1

        // Map amplitude to glow intensity
        const intensity = Math.min(avg * 2.5, 1)
        const blueGlow = Math.round(100 + intensity * 155)  // 100-255 blue
        const warmGlow = Math.round(intensity * 120)          // 0-120 warm/tungsten
        const whiteGlow = Math.round(intensity * 80)          // 0-80 white

        glowRef.current.style.opacity = String(0.15 + intensity * 0.6)
        glowRef.current.style.background = `radial-gradient(ellipse at center, rgba(${warmGlow},${Math.round(warmGlow * 0.7)},${blueGlow},${intensity * 0.3}) 0%, rgba(30,60,${blueGlow},${intensity * 0.15}) 40%, rgba(${whiteGlow},${whiteGlow},${Math.round(whiteGlow + blueGlow * 0.3)},${intensity * 0.05}) 70%, transparent 100%)`
      }
      glowRafRef.current = requestAnimationFrame(animate)
    }
    glowRafRef.current = requestAnimationFrame(animate)

    // ─── Manifesto text audio-reactive animation ───
    const manifestoData = new Uint8Array(256)
    let manifestoPhase = 0
    const animateManifesto = () => {
      const el = manifestoRef.current
      if (!el || !analyserRef.current) {
        manifestoRafRef.current = requestAnimationFrame(animateManifesto)
        return
      }
      analyserRef.current.getByteFrequencyData(manifestoData)
      // Split frequency bands
      let bass = 0, mid = 0, high = 0
      for (let i = 0; i < 16; i++) bass += manifestoData[i]    // sub + kick
      for (let i = 16; i < 80; i++) mid += manifestoData[i]    // mids
      for (let i = 80; i < 200; i++) high += manifestoData[i]  // highs/hats
      bass = bass / (16 * 255)
      mid = mid / (64 * 255)
      high = high / (120 * 255)
      manifestoPhase += 0.008

      // Animate each child span/div inside the manifesto
      const children = el.children
      if (!children.length) { manifestoRafRef.current = requestAnimationFrame(animateManifesto); return }
      const inner = children[0] as HTMLElement
      if (!inner) { manifestoRafRef.current = requestAnimationFrame(animateManifesto); return }

      // Overall container breathe with bass
      const containerScale = 1 + bass * 0.06
      inner.style.transform = `scale(${containerScale})`

      const spans = inner.children
      for (let i = 0; i < spans.length; i++) {
        const child = spans[i] as HTMLElement
        if (!child) continue
        const tag = child.tagName.toLowerCase()

        if (tag === 'div') {
          // Divider lines — pulse with highs — cyan + orange gradient
          const w = 30 + high * 40
          child.style.width = `${w}%`
          child.style.opacity = String(0.3 + high * 0.7)
          child.style.background = `linear-gradient(90deg, transparent, rgba(34,211,238,${0.3 + high * 0.5}), rgba(103,232,249,${0.15 + high * 0.3}), rgba(34,211,238,${0.3 + high * 0.5}), transparent)`
          continue
        }

        // Text spans — stagger animation by index
        const stagger = Math.sin(manifestoPhase + i * 0.5) * 0.5 + 0.5 // 0-1 wave
        const isHero = i <= 2 // "Welcome to", "444", "Radio"
        const isBig = i >= 4 && i <= 7 // "Vibe", separator, "Free the Music", "Free the Soul"

        if (i === 1) {
          // "444" — the hero, reacts heavily to bass — pure cyan glow
          const s = 1 + bass * 0.15
          const innerGlow = 30 + bass * 100
          const outerGlow = 60 + bass * 200
          const deepGlow = 100 + bass * 300
          child.style.transform = `scale(${s})`
          child.style.opacity = String(0.7 + bass * 0.3)
          child.style.color = `rgb(${Math.round(165 + bass * 30)},${Math.round(243 + bass * 12)},${Math.round(252)})`
          child.style.textShadow = `0 0 ${innerGlow}px rgba(34,211,238,${0.4 + bass * 0.5}), 0 0 ${outerGlow}px rgba(6,182,212,${0.2 + bass * 0.4}), 0 0 ${deepGlow}px rgba(8,145,178,${0.1 + bass * 0.25})`
          child.style.transition = 'none'
        } else if (isHero) {
          // "Welcome to" / "Radio" — mid-frequency pulse — cyan
          const pulse = mid * 0.8 + stagger * 0.2
          child.style.opacity = String(0.5 + pulse * 0.5)
          child.style.transform = `translateY(${Math.sin(manifestoPhase + i) * (2 + mid * 3)}px)`
          child.style.color = `rgb(${Math.round(103 + pulse * 62)},${Math.round(232 + pulse * 11)},${Math.round(249 + pulse * 3)})`
          child.style.textShadow = `0 0 ${15 + mid * 40}px rgba(34,211,238,${0.3 + mid * 0.5}), 0 0 ${30 + mid * 60}px rgba(6,182,212,${0.12 + mid * 0.25})`
          child.style.transition = 'none'
        } else if (isBig) {
          // "Vibe with 444", "Free the Music", "Free the Soul" — cyan pulse
          const energy = mid * 0.6 + bass * 0.4
          child.style.opacity = String(0.4 + energy * 0.6)
          child.style.transform = `translateY(${Math.sin(manifestoPhase * 0.7 + i * 0.8) * (1 + energy * 4)}px) scale(${1 + energy * 0.04})`
          child.style.color = `rgb(${Math.round(34 + energy * 69)},${Math.round(211 + energy * 21)},${Math.round(238 + energy * 11)})`
          child.style.textShadow = `0 0 ${12 + energy * 45}px rgba(34,211,238,${0.25 + energy * 0.45}), 0 0 ${25 + energy * 60}px rgba(6,182,212,${0.1 + energy * 0.25})`
          child.style.transition = 'none'
        } else {
          // Smaller text lines — gentle high-frequency shimmer — cyan
          const shimmer = high * 0.5 + stagger * 0.3
          child.style.opacity = String(0.3 + shimmer * 0.5)
          child.style.transform = `translateY(${Math.sin(manifestoPhase * 1.2 + i * 1.1) * (1 + high * 2)}px)`
          child.style.color = `rgb(${Math.round(6 + shimmer * 28)},${Math.round(182 + shimmer * 29)},${Math.round(212 + shimmer * 26)})`
          child.style.textShadow = `0 0 ${8 + high * 22}px rgba(34,211,238,${0.15 + shimmer * 0.3}), 0 0 ${18 + high * 35}px rgba(6,182,212,${0.08 + shimmer * 0.18})`
          child.style.transition = 'none'
        }
      }
      manifestoRafRef.current = requestAnimationFrame(animateManifesto)
    }
    manifestoRafRef.current = requestAnimationFrame(animateManifesto)

    // Poll active haps + token locations for display
    const hapTimer = setInterval(() => {
      const current = Array.from(activeHapsRef.current)
      setActiveHaps(prev => {
        if (prev.length !== current.length || prev.some((s, i) => s !== current[i])) return current
        return prev
      })
      // Update token highlight ranges from Drawer
      const locs = activeLocsRef.current
      setHighlightRanges(prev => {
        if (prev.length !== locs.length) return [...locs]
        for (let i = 0; i < prev.length; i++) {
          if (prev[i].start !== locs[i].start || prev[i].end !== locs[i].end) return [...locs]
        }
        return prev
      })
    }, 60)

    return () => {
      if (glowRafRef.current) cancelAnimationFrame(glowRafRef.current)
      if (manifestoRafRef.current) cancelAnimationFrame(manifestoRafRef.current)
      clearInterval(hapTimer)
    }
  }, [isPlaying])

  return (
    <div className="flex flex-col h-full bg-black/30 text-gray-200 font-mono select-none">
      {/* ─── Compact Top Bar — 3-column: Left (status + toggles) | Center (transport) | Right (tools) ─── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06] backdrop-blur-2xl shrink-0 relative z-[60]">
        {/* ── LEFT: Status + sidebar toggles ── */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlaying ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]' : status === 'loading' ? 'bg-cyan-300 animate-pulse' : 'bg-white/15'}`} />
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase shrink-0">INPUT</span>
          {status === 'loading' && (
            <span className="text-[9px] text-white/20 ml-1 truncate">{loadingMsg}</span>
          )}

          {/* Examples sidebar toggle (SVG icon) */}
          <button
            onClick={() => {
              if (showPanel && activePanel === 'examples') { setShowPanel(false) }
              else { setShowPanel(true); setActivePanel('examples') }
            }}
            className={`ml-2 w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer shrink-0 ${showPanel && activePanel === 'examples' ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25' : 'text-white/25 hover:text-white/50 border border-white/[0.06]'}`}
            title={showPanel && activePanel === 'examples' ? 'Close examples' : 'Open examples'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.915a2 2 0 00-1.272 1.272L12 21l-1.912-5.813a2 2 0 00-1.272-1.272L3 12l5.816-1.915a2 2 0 001.272-1.272z"/></svg>
          </button>

          {/* Node Rack sidebar toggle (SVG icon) — only when node view is active */}
          {showNodes && nodeEditorRef.current && (
            <button
              onClick={() => nodeEditorRef.current?.toggleSidebar()}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer shrink-0 ${nodeEditorRef.current.sidebarOpen ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25' : 'text-white/25 hover:text-white/50 border border-white/[0.06]'}`}
              title={nodeEditorRef.current.sidebarOpen ? 'Close node rack' : 'Open node rack'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          )}

          {/* Arrangement toggle — only when node view is active */}
          {showNodes && nodeEditorRef.current && (
            <button
              onClick={() => nodeEditorRef.current?.toggleArrangement()}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer shrink-0 text-[11px] ${nodeEditorRef.current.arrangementMode ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : 'text-white/25 hover:text-white/50 border border-white/[0.06]'}`}
              title={nodeEditorRef.current.arrangementMode ? 'Arrangement mode ON — click to toggle' : 'Arrangement mode OFF — click to enable'}>
              🎬
            </button>
          )}

          {/* Active sounds indicator — flashes when haps trigger */}
          {isPlaying && activeHaps.length > 0 && (
            <div className="flex items-center gap-1 ml-1 max-w-[140px] overflow-hidden shrink-0">
              {activeHaps.slice(0, 4).map((s, i) => (
                <span key={`${s}-${i}`}
                  className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400/30 rounded text-[8px] font-mono text-cyan-300/80 animate-pulse whitespace-nowrap"
                  style={{ animationDuration: '0.3s' }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── CENTER: Transport controls (fixed position) ── */}
        <div className="flex items-center gap-1.5 px-4">
          <button
            onClick={isPlaying ? handleStop : handlePlay}
            disabled={status === 'loading'}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-bold transition-all disabled:opacity-20 cursor-pointer ${
              isPlaying
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25 shadow-[0_0_12px_rgba(34,211,238,0.1)]'
                : 'bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:bg-cyan-500/20 hover:border-cyan-400/50 hover:text-cyan-200 hover:shadow-[0_0_20px_rgba(34,211,238,0.25)]'
            }`}
          >
            {isPlaying ? <><Square size={9} className="fill-current" /> stop</> : <><Play size={9} className="fill-current" /> play</>}
          </button>
          <button onClick={() => handleUpdate()} disabled={!isPlaying}
            className="px-2 py-1 rounded-md text-[11px] border border-white/[0.06] text-white/20 hover:text-cyan-400 hover:border-cyan-500/20 transition disabled:opacity-15 cursor-pointer">
            update
          </button>
          <button
            onClick={handleToggleRecording}
            disabled={!isPlaying}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all disabled:opacity-15 cursor-pointer ${
              isRecording
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                : 'bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-red-400 hover:border-red-500/25'
            }`}
            title={isRecording ? 'Stop & bounce to WAV' : 'Bounce to WAV (start playing first)'}
          >
            {isRecording ? (
              <><CircleDot size={9} className="animate-pulse" /> {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}</>
            ) : (
              <><Download size={9} /> bounce</>
            )}
          </button>

          {/* Custom samples uploader */}
          <button
            onClick={() => setShowSoundUploader(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-purple-400 hover:border-purple-500/25"
            title="Upload custom audio samples">
            <Upload size={9} /> samples
          </button>

          {/* Metronome toggle (SVG pendulum icon, animated based on BPM when active) */}
          <button
            onClick={() => setMetronomeEnabled(p => !p)}
            className={`relative w-7 h-7 flex items-center justify-center rounded-md transition-all cursor-pointer border ${
              metronomeEnabled
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                : 'text-white/25 hover:text-white/50 border-white/[0.06]'
            }`}
            title={metronomeEnabled ? `Metronome ON (${nodeEditorRef.current?.bpm || 72} BPM) — click to mute` : 'Metronome OFF — click to enable'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={metronomeEnabled && isPlaying ? {
                animation: `metronomeSwing ${60 / (nodeEditorRef.current?.bpm || 72)}s ease-in-out infinite alternate`,
                transformOrigin: '12px 20px',
              } : undefined}>
              {/* Metronome body (triangle) */}
              <path d="M7 22L12 2L17 22" />
              {/* Pendulum arm */}
              <line x1="12" y1="22" x2="12" y2="8" />
              {/* Pendulum weight */}
              <circle cx="12" cy="8" r="2" fill="currentColor" />
              {/* Base */}
              <line x1="6" y1="22" x2="18" y2="22" />
            </svg>
            {metronomeEnabled && (
              <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.5)]" />
            )}
          </button>
        </div>

        {/* ── RIGHT: Tools + panels ── */}
        <div className="flex items-center gap-1.5 justify-end min-w-0">
          {/* Undo / Redo */}
          <div className="flex items-center rounded-md overflow-hidden border border-white/[0.06]">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="px-1.5 py-1 text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-15 disabled:hover:text-white/20 disabled:hover:bg-transparent cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={11} />
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="px-1.5 py-1 text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all disabled:opacity-15 disabled:hover:text-white/20 disabled:hover:bg-transparent cursor-pointer"
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 size={11} />
            </button>
          </div>

          {/* Master Volume */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/[0.06] bg-white/[0.02]">
            <Volume2 size={10} className={`shrink-0 ${masterVolume === 0 ? 'text-red-400/40' : 'text-white/25'}`} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
              className="w-16 h-1 accent-white/50 cursor-pointer"
              title={`Volume: ${Math.round(masterVolume * 100)}%`}
            />
            <span className="text-[9px] text-white/20 font-mono w-6 text-right">{Math.round(masterVolume * 100)}</span>
          </div>

          {/* Panel tabs */}
          <div className="flex items-center rounded-md overflow-hidden border border-white/[0.06]">
            <button onClick={() => { if (showPanel && activePanel === 'examples') setShowPanel(false); else { setShowPanel(true); setActivePanel('examples') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'examples' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Examples">
              <Sparkles size={15} />
            </button>
            <button onClick={() => { if (showPanel && activePanel === 'sounds') setShowPanel(false); else { setShowPanel(true); setActivePanel('sounds') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'sounds' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Sounds">
              <Volume2 size={15} />
            </button>
            <button onClick={() => { if (showPanel && activePanel === 'settings') setShowPanel(false); else { setShowPanel(true); setActivePanel('settings') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'settings' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Settings">
              <Palette size={15} />
            </button>
            <button onClick={() => { if (showPanel && activePanel === 'patterns') setShowPanel(false); else { setShowPanel(true); setActivePanel('patterns') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'patterns' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="My Patterns">
              <FolderOpen size={15} />
            </button>
            <button onClick={() => { if (showPanel && activePanel === 'learn') setShowPanel(false); else { setShowPanel(true); setActivePanel('learn') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'learn' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Learn">
              <BookOpen size={15} />
            </button>
            <button onClick={() => { if (showPanel && activePanel === 'vibe') setShowPanel(false); else { setShowPanel(true); setActivePanel('vibe') } }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'vibe' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Vibe with 444">
              <MessageCircle size={15} />
            </button>
            <div className="w-px h-4 bg-white/[0.06] mx-0.5" />
            <button onClick={() => setShowNodes(p => !p)}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showNodes ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Node View (visual editor)">
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* Release Pattern button */}
          <button
            onClick={() => setShowReleaseModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all text-[10px] font-semibold tracking-wide uppercase cursor-pointer shrink-0"
            title="Release your pattern code to the community"
          >
            <Upload size={10} />
            Release
          </button>

          {/* ═══ NDE CONTROLS (shown when node view is active) ═══ */}
          {showNodes && nodeEditorRef.current && (() => {
            const nde = nodeEditorRef.current!
            return (
              <div className="flex items-center gap-1">
                {/* BPM display — tap to type, scroll to adjust, ± buttons */}
                <div className="flex items-center gap-0 px-1 py-0.5 rounded-md border border-white/[0.06] bg-white/[0.02] select-none">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-white/20 mr-1">BPM</span>
                  <button
                    onClick={e => { e.stopPropagation(); nde.handleBpmChange((nde.bpm || 72) - 1) }}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/30 hover:text-cyan-400 cursor-pointer transition-colors rounded-l"
                    title="Decrease BPM">−</button>
                  <input
                    type="number"
                    min={30} max={300}
                    value={nde.bpm || 72}
                    onChange={e => nde.handleBpmChange(parseInt(e.target.value) || 72)}
                    onWheel={e => { e.preventDefault(); nde.handleBpmChange((nde.bpm || 72) + (e.deltaY < 0 ? 1 : -1)) }}
                    className="w-8 bg-transparent text-[11px] font-mono text-cyan-400 text-center outline-none font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onClick={e => { e.stopPropagation(); (e.target as HTMLInputElement).select() }}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); nde.handleBpmChange((nde.bpm || 72) + 1) }}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/30 hover:text-cyan-400 cursor-pointer transition-colors rounded-r"
                    title="Increase BPM">+</button>
                </div>
                {/* Time signature selector */}
                <select
                  value={nde.timeSig || '4/4'}
                  onChange={e => { e.stopPropagation(); nde.handleTimeSigChange(e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className="px-1 py-0.5 rounded text-[9px] font-mono font-bold text-purple-400 bg-white/[0.02] border border-white/[0.06] outline-none cursor-pointer appearance-none text-center"
                  title="Time signature"
                  style={{ width: 36 }}
                >
                  {['4/4', '3/4', '2/4', '6/8', '5/4', '7/8', '12/8', '9/8'].map(ts => (
                    <option key={ts} value={ts} className="bg-gray-900 text-white">{ts}</option>
                  ))}
                </select>
                {/* Global Scale / Key */}
                <select
                  value={nde.globalScale || 'C4:major'}
                  onChange={e => { e.stopPropagation(); nde.handleGlobalScaleChange(e.target.value) }}
                  onClick={e => e.stopPropagation()}
                  className="px-1 py-0.5 rounded text-[9px] font-bold text-violet-400 bg-white/[0.02] border border-white/[0.06] outline-none cursor-pointer appearance-none text-center truncate"
                  title="Global scale / key"
                  style={{ maxWidth: 90 }}
                >
                  {(() => {
                    const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
                    const types = [
                      { l: 'Maj', v: 'major', o: 4 }, { l: 'Min', v: 'minor', o: 3 },
                      { l: 'Harm', v: 'harmonic minor', o: 3 }, { l: 'MelMin', v: 'melodic minor', o: 3 },
                      { l: 'Dor', v: 'dorian', o: 4 }, { l: 'Phry', v: 'phrygian', o: 4 },
                      { l: 'Lyd', v: 'lydian', o: 4 }, { l: 'Mix', v: 'mixolydian', o: 4 },
                      { l: 'Loc', v: 'locrian', o: 4 }, { l: 'MajP', v: 'major pentatonic', o: 4 },
                      { l: 'MinP', v: 'minor pentatonic', o: 3 }, { l: 'Blues', v: 'blues', o: 4 },
                      { l: 'WhlT', v: 'whole tone', o: 4 }, { l: 'Dim', v: 'diminished', o: 4 },
                      { l: 'Chrom', v: 'chromatic', o: 4 },
                    ]
                    return roots.flatMap(r => types.map(t => ({
                      label: `${r} ${t.l}`,
                      value: `${r}${t.o}:${t.v}`,
                    })))
                  })().map(s => (
                    <option key={s.value} value={s.value} className="bg-gray-900 text-white">{s.label}</option>
                  ))}
                </select>
                {/* Node count */}
                <span className="text-[8px] font-mono text-white/20 px-1">{nde.activeCount}/{nde.nodeCount}</span>
                {/* Collapse / Expand */}
                <button onClick={() => nde.toggleAllCollapsed()}
                  className="px-1.5 py-1 text-white/20 hover:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer rounded"
                  title={nde.allCollapsed ? 'Expand all nodes' : 'Collapse all nodes'}>
                  {nde.allCollapsed ? <Columns size={12} /> : <LayoutList size={12} />}
                </button>
                {/* Add node */}
                <div className="relative">
                  <button onClick={() => setShowNodeAddMenu(p => !p)}
                    className={`px-1.5 py-1 transition-all cursor-pointer rounded ${showNodeAddMenu ? 'text-cyan-400 bg-cyan-500/15' : 'text-cyan-300/60 hover:text-cyan-400 hover:bg-cyan-500/10'}`}
                    title="Add node"
                    onMouseDown={e => { e.stopPropagation() }}
                  >
                    <Plus size={12} />
                  </button>
                  {showNodeAddMenu && (
                    <div className="absolute right-0 top-full mt-1 z-[60] min-w-[200px] rounded-xl shadow-2xl overflow-hidden border border-white/10"
                      style={{ background: '#0e0e11' }}>
                      <div className="px-3 pt-2 pb-1">
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-white/25">SOUND SOURCES</span>
                      </div>
                      {[
                        { type: 'drums', icon: '⬤', color: '#f59e0b', desc: '808 kit' },
                        { type: 'bass', icon: '◆', color: '#ef4444', desc: 'Sub bass' },
                        { type: 'melody', icon: '▲', color: '#22d3ee', desc: 'Piano melody' },
                        { type: 'chords', icon: '■', color: '#a78bfa', desc: 'Chord progression' },
                        { type: 'pad', icon: '◈', color: '#818cf8', desc: 'Slow atmosphere' },
                        { type: 'vocal', icon: '●', color: '#f472b6', desc: 'Choir / vocal' },
                      ].map(({ type, icon, color, desc }) => (
                        <button key={type} onClick={() => { nde.addNode(type); setShowNodeAddMenu(false) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors cursor-pointer hover:bg-white/5"
                          style={{ color }}>
                          <span className="text-[11px] w-4 text-center">{icon}</span>
                          <span className="capitalize font-medium">{type}</span>
                          <span className="text-[8px] ml-auto opacity-40">{desc}</span>
                        </button>
                      ))}
                      <div className="px-3 pt-1.5 pb-1 border-t border-white/5">
                        <span className="text-[7px] font-bold tracking-[0.2em] uppercase text-white/25">UTILITY</span>
                      </div>
                      <button onClick={() => { nde.addNode('fx'); setShowNodeAddMenu(false) }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors cursor-pointer hover:bg-white/5"
                        style={{ color: '#34d399' }}>
                        <span className="text-[11px] w-4 text-center">✦</span>
                        <span className="font-medium">FX / Texture</span>
                        <span className="text-[8px] ml-auto opacity-40">Effects layer</span>
                      </button>
                    </div>
                  )}
                </div>
                {/* Zoom */}
                <div className="flex items-center gap-0.5">
                  <button onClick={() => nde.setZoom((z: number) => Math.max(0.25, z - 0.15))}
                    className="w-5 h-5 flex items-center justify-center text-[10px] rounded cursor-pointer text-white/20 hover:text-white/40 bg-white/[0.02] border border-white/[0.06]">−</button>
                  <span className="text-[7px] w-6 text-center font-mono text-white/20">{Math.round(nde.zoom * 100)}%</span>
                  <button onClick={() => nde.setZoom((z: number) => Math.min(2, z + 0.15))}
                    className="w-5 h-5 flex items-center justify-center text-[10px] rounded cursor-pointer text-white/20 hover:text-white/40 bg-white/[0.02] border border-white/[0.06]">+</button>
                  <button onClick={() => nde.resetView()}
                    className="px-1 h-5 flex items-center justify-center text-[7px] font-bold tracking-wider uppercase rounded cursor-pointer text-white/20 hover:text-white/40 bg-white/[0.02] border border-white/[0.06]">FIT</button>
                </div>
                {/* Fullscreen */}
                <button onClick={() => nde.toggleFullscreen()}
                  className={`px-1.5 py-1 transition-all cursor-pointer rounded ${nde.isFullscreen ? 'text-cyan-400 bg-cyan-500/10' : 'text-white/20 hover:text-white/40'}`}
                  title={nde.isFullscreen ? 'Exit fullscreen' : 'Fullscreen node grid'}>
                  {nde.isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                </button>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ─── Main: Editor (max canvas) + Node View + Panel ─── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Code Editor — resizes when node view is open */}
        <div ref={editorContainerRef} className={`flex flex-col min-w-0 relative transition-all duration-300 ${showNodes ? 'w-1/2' : 'flex-1'}`} style={{ backgroundColor: themeColors.background }}>

          {/* Viewport wrapper — positions canvas overlay + scroll area as siblings */}
          <div className="flex-1 relative min-h-0">
            {/* Audio-reactive glow background */}
            <div
              ref={glowRef}
              className="absolute inset-0 z-[2] pointer-events-none transition-opacity duration-300"
              style={{ opacity: 0 }}
            />
            {/* Visualization canvas — behind code, subtle depth */}
            <canvas
              ref={canvasRef}
              id="test-canvas"
              className="absolute inset-0 pointer-events-none z-[3]"
              style={{ opacity: isPlaying ? 0.45 : 0, transition: 'opacity 0.6s ease', pointerEvents: 'none' }}
            />

            {/* ── Manifesto text backdrop — audio-reactive, only on default code ── */}
            {isDefaultCode && (
            <div
              ref={manifestoRef}
              className="absolute inset-0 pointer-events-none z-[4] flex flex-col items-center justify-center select-none overflow-hidden"
              style={{ opacity: isPlaying ? 0.28 : 0, transition: 'opacity 1s ease' }}
            >
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem',
                fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: 800, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: '#22d3ee', textAlign: 'center',
                lineHeight: 1.1, willChange: 'transform',
              }}>
                <span style={{ fontSize: 'clamp(1.8rem, 4.5vw, 4rem)', opacity: 0.5, color: '#67e8f9', textShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 50px rgba(6,182,212,0.2)' }}>Welcome to</span>
                <span style={{ fontSize: 'clamp(4rem, 12vw, 10rem)', letterSpacing: '0.3em', color: '#a5f3fc', fontWeight: 900, textShadow: '0 0 40px rgba(34,211,238,0.5), 0 0 80px rgba(6,182,212,0.3), 0 0 120px rgba(34,211,238,0.15)' }}>444</span>
                <span style={{ fontSize: 'clamp(1.5rem, 3.5vw, 3rem)', opacity: 0.5, color: '#67e8f9', textShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 50px rgba(6,182,212,0.2)' }}>Radio</span>
                <div style={{ width: '50%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.5), rgba(103,232,249,0.3), rgba(34,211,238,0.5), transparent)' }} />
                <span style={{ fontSize: 'clamp(1rem, 2.5vw, 2rem)', letterSpacing: '0.3em', opacity: 0.45, color: '#22d3ee', textShadow: '0 0 15px rgba(34,211,238,0.3), 0 0 35px rgba(6,182,212,0.15)' }}>Vibe with 444</span>
                <div style={{ width: '35%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(103,232,249,0.25), rgba(34,211,238,0.4), transparent)' }} />
                <span style={{ fontSize: 'clamp(1.3rem, 3vw, 2.5rem)', letterSpacing: '0.25em', color: '#67e8f9', opacity: 0.55, textShadow: '0 0 25px rgba(34,211,238,0.4), 0 0 60px rgba(6,182,212,0.2)' }}>Free the Music</span>
                <span style={{ fontSize: 'clamp(1.3rem, 3vw, 2.5rem)', letterSpacing: '0.25em', opacity: 0.45, color: '#22d3ee', textShadow: '0 0 20px rgba(34,211,238,0.35), 0 0 50px rgba(6,182,212,0.15)' }}>Free the Soul</span>
                <div style={{ width: '40%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.4), rgba(103,232,249,0.25), rgba(34,211,238,0.4), transparent)' }} />
                <span style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1.1rem)', letterSpacing: '0.2em', color: '#06b6d4', opacity: 0.4, textShadow: '0 0 12px rgba(34,211,238,0.25), 0 0 30px rgba(6,182,212,0.12)' }}>Every creator deserves liberation</span>
                <span style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1.1rem)', letterSpacing: '0.2em', color: '#06b6d4', opacity: 0.4, textShadow: '0 0 12px rgba(34,211,238,0.25), 0 0 30px rgba(6,182,212,0.12)' }}>Every voice deserves to be heard</span>
                <span style={{ fontSize: 'clamp(0.7rem, 1.5vw, 1.1rem)', letterSpacing: '0.2em', color: '#06b6d4', opacity: 0.4, textShadow: '0 0 12px rgba(34,211,238,0.25), 0 0 30px rgba(6,182,212,0.12)' }}>Music is the frequency of freedom</span>
                <div style={{ width: '25%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(34,211,238,0.35), rgba(103,232,249,0.2), rgba(34,211,238,0.35), transparent)' }} />
                <span style={{ fontSize: 'clamp(0.8rem, 1.8vw, 1.3rem)', letterSpacing: '0.35em', color: '#22d3ee', opacity: 0.45, textShadow: '0 0 18px rgba(34,211,238,0.3), 0 0 40px rgba(6,182,212,0.15)' }}>Join the movement</span>
                <span style={{ fontSize: 'clamp(0.65rem, 1.2vw, 0.9rem)', letterSpacing: '0.4em', opacity: 0.35, color: '#0891b2', textShadow: '0 0 10px rgba(34,211,238,0.2), 0 0 25px rgba(6,182,212,0.1)' }}>We are 444</span>
              </div>
            </div>
            )}

            {/* Scrollable code area — above canvas for depth */}
            <div className="absolute inset-0 overflow-auto z-[5]">
              <div className="flex min-h-full">
                {/* Line numbers */}
                {showLineNumbers && (
                <div className="flex flex-col items-end pr-1.5 pl-2 pt-3 select-none shrink-0" style={{ color: themeColors.gutterForeground, lineHeight: '1.7', fontSize: `${editorFontSize}px` }}>
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} style={{ height: '1.7em' }} className="flex items-center justify-end"><span className="text-[11px]">{i + 1}</span></div>
                  ))}
                </div>
                )}
                {/* Code + inline sliders */}
                <div className="flex-1 relative min-w-0">
                  {/* Token highlight overlay — outlines on active mini-notation values */}
                  {highlightEvents && isPlaying && highlightRanges.length > 0 && (() => {
                    // Build segments: split code into normal + highlighted spans
                    const src = code
                    // Merge overlapping ranges and sort by start
                    const sorted = [...highlightRanges].sort((a, b) => a.start - b.start)
                    const merged: {start: number, end: number}[] = []
                    for (const r of sorted) {
                      const last = merged[merged.length - 1]
                      if (last && r.start <= last.end) {
                        last.end = Math.max(last.end, r.end)
                      } else {
                        merged.push({ ...r })
                      }
                    }
                    // Build segments array
                    const segments: {text: string, active: boolean}[] = []
                    let pos = 0
                    for (const r of merged) {
                      const start = Math.max(0, Math.min(r.start, src.length))
                      const end = Math.max(start, Math.min(r.end, src.length))
                      if (pos < start) {
                        segments.push({ text: src.slice(pos, start), active: false })
                      }
                      if (start < end) {
                        segments.push({ text: src.slice(start, end), active: true })
                      }
                      pos = end
                    }
                    if (pos < src.length) {
                      segments.push({ text: src.slice(pos), active: false })
                    }
                    return (
                      <div
                        className="absolute inset-0 pt-3 pb-3 pl-2 pr-3 pointer-events-none z-[15]"
                        style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.7', tabSize: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflow: 'hidden' }}
                        aria-hidden="true"
                      >
                        {segments.map((seg, i) =>
                          seg.active ? (
                            <span
                              key={i}
                              style={{
                                color: 'transparent',
                                outline: `solid 1.5px ${themeColors.foreground}`,
                                outlineOffset: '-1px',
                                borderRadius: '2px',
                                background: `${themeColors.foreground}18`,
                              }}
                            >{seg.text}</span>
                          ) : (
                            <span key={i} style={{ color: 'transparent' }}>{seg.text}</span>
                          )
                        )}
                      </div>
                    )
                  })()}
                  {/* Display overlay — visible code with inline slider widgets (z-20 above textarea z-10) */}
                  {hasSliders && (
                    <div
                      className="absolute inset-0 pt-3 pb-3 pl-2 pr-3 pointer-events-none z-20"
                      style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.7', tabSize: 2, color: themeColors.foreground }}
                      aria-hidden="true"
                    >
                      {codeLines.map((_, lineIdx) => (
                        <div key={lineIdx} style={{ height: '1.7em', whiteSpace: 'pre', overflow: 'hidden' }}>
                          {renderCodeLine(lineIdx)}
                        </div>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={textareaRef}
                    value={code}
                    onChange={e => {
                      if (isUndoRedoRef.current) {
                        isUndoRedoRef.current = false
                        return
                      }
                      setCodeWithUndo(e.target.value)
                    }}
                    onKeyDown={handleKeyDown}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'copy'
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const text = e.dataTransfer.getData('text/plain')
                      if (!text) return
                      const ta = textareaRef.current
                      if (!ta) return
                      // Insert at cursor position
                      const pos = ta.selectionStart
                      setCodeWithUndo(prev => prev.substring(0, pos) + text + prev.substring(pos))
                      setTimeout(() => {
                        ta.focus()
                        ta.selectionStart = ta.selectionEnd = pos + text.length
                      }, 0)
                    }}
                    className="w-full h-full bg-transparent p-3 pl-2 pr-3 resize-none focus:outline-none min-w-0 z-10 relative block"
                    placeholder="// Enter pattern code..."
                    spellCheck={false}
                    autoCorrect="off"
                    autoCapitalize="off"
                    style={{
                      fontSize: `${editorFontSize}px`,
                      lineHeight: '1.7',
                      tabSize: 2,
                      caretColor: themeColors.caret,
                      color: hasSliders ? 'transparent' : themeColors.foreground,
                      backgroundColor: 'transparent',
                      overflow: 'hidden',
                      whiteSpace: lineWrapping ? 'pre-wrap' : 'pre',
                      wordBreak: lineWrapping ? 'break-all' : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="px-3 py-1 bg-white/[0.02] border-t border-white/[0.04] flex items-center justify-between text-[9px] shrink-0">
            <div className="flex items-center gap-2">
              {isPlaying && <span className="w-1 h-1 rounded-full bg-cyan-400 animate-pulse" />}
              <span className={error ? 'text-red-400/70' : isPlaying ? 'text-cyan-400/50' : 'text-white/15'}>
                {error || (isPlaying ? 'playing' : status === 'loading' ? loadingMsg : 'ready')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-white/30">
              <span>space = play</span>
              <span>. = update</span>
              <span>ctrl+z/y = undo/redo</span>
            </div>
          </div>
        </div>

        {/* ═══ NODE VIEW (split) ═══ */}
        {showNodes && (
          <div className="w-1/2 flex flex-col border-l border-white/[0.06] bg-black/60 min-h-0 overflow-hidden">
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-white/20 text-xs">Loading nodes…</div>}>
              <NodeEditor
                ref={nodeEditorRef}
                code={code}
                isPlaying={isPlaying}
                onCodeChange={handleNodeCodeChange}
                onUpdate={handleNodeUpdate}
                onRegisterSound={registerCustomSound}
                analyserNode={analyserRef.current}
                getAnalyserById={getAnalyserByIdCb}
                getCyclePosition={getCyclePosition}
                headerless
              />
            </Suspense>
          </div>
        )}

        {/* ═══ SIDE PANEL ═══ */}
        {showPanel && (
          <div className={`w-72 lg:w-80 flex flex-col border-l border-white/[0.06] bg-black/40 shrink-0 ${nodeEditorRef.current?.isFullscreen ? 'fixed right-0 z-[51] bg-black/95 backdrop-blur-xl' : ''}`}
            style={nodeEditorRef.current?.isFullscreen ? { top: 36, bottom: 0 } : undefined}>

            {/* ═══ EXAMPLES PANEL ═══ */}
            {activePanel === 'examples' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Search */}
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      value={exampleSearch}
                      onChange={e => setExampleSearch(e.target.value)}
                      placeholder="Search examples..."
                      className="w-full bg-white/[0.04] text-cyan-400/80 text-[11px] pl-7 pr-3 py-1.5 rounded border border-white/[0.06] focus:outline-none focus:border-cyan-500/30 placeholder-white/15"
                    />
                  </div>
                </div>

                {/* Example categories */}
                <div className="flex-1 overflow-y-auto">
                  {(() => {
                    const searchQ = exampleSearch.toLowerCase().trim()
                    if (searchQ) {
                      // Search results — flat list
                      const results: { cat: string; label: string; code: string; inline?: boolean }[] = []
                      for (const cat of EXAMPLE_CATEGORIES) {
                        for (const ex of cat.examples) {
                          if (ex.label.toLowerCase().includes(searchQ) || ex.code.toLowerCase().includes(searchQ)) {
                            results.push({ cat: cat.category, label: ex.label, code: ex.code, inline: (ex as any).inline })
                          }
                        }
                      }
                      return results.length === 0 ? (
                        <div className="text-center text-[10px] text-white/15 py-8">No matching examples</div>
                      ) : (
                        <div className="p-1.5">
                          <div className="text-[9px] text-white/20 px-2 py-1">{results.length} result{results.length !== 1 ? 's' : ''}</div>
                          {results.map((r, i) => (
                            <div key={`search-${i}`} className="group flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.04] transition">
                              <div className="flex-1 min-w-0">
                                <span className="text-[10px] text-cyan-300/70 truncate block">{r.label}</span>
                                <span className="text-[8px] text-white/15">{r.cat}</span>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button onClick={() => r.inline ? appendToLine(r.code) : addExample(r.code)}
                                  className="px-1.5 py-0.5 text-[8px] bg-cyan-500/15 text-cyan-400/70 rounded hover:bg-cyan-500/25 transition cursor-pointer">{r.inline ? '+ LINE' : 'ADD'}</button>
                                {!r.inline && <button onClick={() => loadExample(r.code)}
                                  className="px-1.5 py-0.5 text-[8px] bg-white/[0.06] text-white/40 rounded hover:bg-white/10 transition cursor-pointer">LOAD</button>}
                                <button onClick={() => copyExample(`search-${i}`, r.code)}
                                  className="px-1.5 py-0.5 text-[8px] bg-white/[0.04] text-white/25 rounded hover:bg-white/[0.08] transition cursor-pointer">
                                  {copiedIndex === `search-${i}` ? <Check size={8} /> : <Copy size={8} />}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    // Normal accordion view
                    return EXAMPLE_CATEGORIES.map(cat => (
                      <div key={cat.category} className="border-b border-white/[0.04]">
                        <button
                          onClick={() => setExpandedCategory(prev => prev === cat.category ? null : cat.category)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.03] transition cursor-pointer"
                        >
                          <span className="text-[11px] text-white/70 flex items-center gap-1.5">
                            <span>{cat.icon}</span>
                            <span>{cat.category}</span>
                            <span className="text-[8px] text-cyan-400/50 ml-1">{cat.examples.length}</span>
                          </span>
                          <ChevronDown size={10} className={`text-white/40 transition-transform ${expandedCategory === cat.category ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedCategory === cat.category && (
                          <div className="px-1.5 pb-2">
                            {cat.examples.map((ex, i) => {
                              const key = `${cat.category}-${i}`
                              return (
                                <div key={key} className="group flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.04] transition">
                                  <span className="text-[10px] text-cyan-300/70 truncate flex-1 min-w-0">{ex.label}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                    <button onClick={() => (ex as any).inline ? appendToLine(ex.code) : addExample(ex.code)}
                                      className="px-1.5 py-0.5 text-[8px] bg-cyan-500/15 text-cyan-400/70 rounded hover:bg-cyan-500/25 transition cursor-pointer">{(ex as any).inline ? '+ LINE' : 'ADD'}</button>
                                    {!(ex as any).inline && <button onClick={() => loadExample(ex.code)}
                                      className="px-1.5 py-0.5 text-[8px] bg-white/[0.06] text-white/40 rounded hover:bg-white/10 transition cursor-pointer">LOAD</button>}
                                    <button onClick={() => copyExample(key, ex.code)}
                                      className="px-1.5 py-0.5 text-[8px] bg-white/[0.04] text-white/25 rounded hover:bg-white/[0.08] transition cursor-pointer">
                                      {copiedIndex === key ? <Check size={8} /> : <Copy size={8} />}
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}

            {/* ═══ SOUNDS PANEL ═══ */}
            {activePanel === 'sounds' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Filter tabs */}
                <div className="flex flex-wrap border-b border-white/[0.06]">
                  {SOUND_FILTERS.map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-2 text-[10px] transition-all cursor-pointer ${
                        activeFilter === f
                          ? 'text-cyan-400 border-b border-cyan-400/50 bg-cyan-500/5'
                          : 'text-white/25 hover:text-white/40'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="p-2 border-b border-white/[0.06]">
                  <div className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      type="text"
                      value={soundSearch}
                      onChange={e => setSoundSearch(e.target.value)}
                      placeholder="Search sounds..."
                      className="w-full bg-white/[0.04] text-cyan-400/80 text-[11px] pl-7 pr-3 py-1.5 rounded border border-white/[0.06] focus:outline-none focus:border-cyan-500/30 placeholder-white/15"
                    />
                  </div>
                </div>

                {/* Sound entries */}
                <div className="flex-1 overflow-y-auto p-2 text-sm">
                  {status === 'loading' ? (
                    <div className="flex flex-col items-center py-8 text-white/20 text-[10px] gap-2">
                      <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
                      {loadingMsg}
                    </div>
                  ) : filteredSounds.length === 0 ? (
                    <div className="text-center text-[10px] text-white/15 py-8">
                      {soundSearch ? 'No matches found' : 'No sounds in this category'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-0.5 leading-relaxed">
                      {filteredSounds.map(s => (
                        <span
                          key={s.name}
                          draggable
                          onDragStart={(e) => {
                            // Set text/plain for code editor drops
                            e.dataTransfer.setData('text/plain', `s("${s.name}")`)
                            // Set structured sidebar-item JSON for NodeEditor drops
                            const isDrumMachine = s.tag === 'drum-machines'
                            e.dataTransfer.setData('application/x-sidebar-item', JSON.stringify({
                              id: `sound-${s.name}`,
                              label: s.name,
                              icon: isDrumMachine ? '🥁' : '🔊',
                              desc: isDrumMachine ? `Drum machine: ${s.name}` : `Sample: ${s.name}`,
                              color: isDrumMachine ? '#f59e0b' : '#22d3ee',
                              dragType: 'sound',
                              payload: s.name,
                              soundCategory: isDrumMachine ? 'drum-machine' : activeFilter === 'synths' ? 'synth' : 'sample',
                            }))
                            e.dataTransfer.effectAllowed = 'copy'
                          }}
                          className="cursor-grab active:cursor-grabbing hover:text-cyan-400 text-[11px] text-white/40 whitespace-nowrap transition"
                          onClick={(e) => {
                            e.preventDefault()
                            previewSound(s.name, { type: s.type })
                          }}
                          title={`Click to preview • Drag to editor to insert`}
                        >
                          {' '}{s.name}{s.type === 'sample' && s.count > 1 ? `(${s.count})` : ''}{s.type === 'wavetable' ? `(${s.count})` : ''}{s.type === 'soundfont' ? `(${s.count})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sound count */}
                <div className="px-3 py-1.5 border-t border-white/[0.06] text-[9px] text-white/15">
                  {filteredSounds.length} sounds
                  {soundSearch && ` matching "${soundSearch}"`}
                </div>
              </div>
            )}

            {/* ═══ SETTINGS PANEL ═══ */}
            {activePanel === 'settings' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto">

                  {/* ── Font Size ── */}
                  <div className="p-3 border-b border-white/[0.06]">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider block mb-2">Font Size</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={10}
                        max={28}
                        value={editorFontSize}
                        onChange={e => updateEditorFontSize(parseInt(e.target.value))}
                        className="flex-1 h-1 accent-cyan-500 cursor-pointer"
                      />
                      <span className="text-[11px] text-cyan-400/70 font-mono w-6 text-right">{editorFontSize}</span>
                    </div>
                  </div>

                  {/* ── Editor Options ── */}
                  <div className="p-3 border-b border-white/[0.06]">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider block mb-2">Editor</span>
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={showLineNumbers} onChange={e => updateShowLineNumbers(e.target.checked)} className="accent-cyan-500 cursor-pointer" />
                      <span className="text-[11px] text-white/40">Display line numbers</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={highlightEvents} onChange={e => updateHighlightEvents(e.target.checked)} className="accent-cyan-500 cursor-pointer" />
                      <span className="text-[11px] text-white/40">Highlight events in code</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={lineWrapping} onChange={e => updateLineWrapping(e.target.checked)} className="accent-cyan-500 cursor-pointer" />
                      <span className="text-[11px] text-white/40">Enable line wrapping</span>
                    </label>
                    <label className="flex items-center gap-2 py-1 cursor-pointer">
                      <input type="checkbox" checked={flashOnEval} onChange={e => updateFlashOnEval(e.target.checked)} className="accent-cyan-500 cursor-pointer" />
                      <span className="text-[11px] text-white/40">Flash on evaluation</span>
                    </label>
                  </div>

                  {/* ── Theme ── */}
                  <div className="p-3 border-b border-white/[0.06]">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider block mb-2">Theme</span>
                  </div>
                  <div className="p-2">
                    {THEME_KEYS.map(name => {
                      const t = STRUDEL_THEMES[name]
                      const isActive = activeTheme === name
                      return (
                        <button
                          key={name}
                          onClick={() => applyTheme(name)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-left transition cursor-pointer ${
                            isActive ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-white/[0.04] border border-transparent'
                          }`}
                        >
                          <div className="w-5 h-5 rounded-sm border border-white/10 shrink-0" style={{ background: t.background }}>
                            <div className="w-full h-full flex items-center justify-center text-[8px] font-bold" style={{ color: t.foreground }}>A</div>
                          </div>
                          <span className={`text-[11px] ${isActive ? 'text-cyan-400' : 'text-white/40'}`}>{name}</span>
                          {isActive && <Check size={10} className="ml-auto text-cyan-400" />}
                        </button>
                      )
                    })}
                  </div>

                </div>
              </div>
            )}

            {/* ═══ PATTERNS PANEL ═══ */}
            {activePanel === 'patterns' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Header */}
                <div className="p-2 border-b border-white/[0.06] flex items-center gap-1.5">
                  <button onClick={() => { setSaveDialogOpen(true); setSavePatternName('') }}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] bg-cyan-500/15 text-cyan-400/70 rounded hover:bg-cyan-500/25 transition cursor-pointer">
                    <Save size={9} /> Save
                  </button>
                  <button onClick={newBlankPattern}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] bg-white/[0.04] text-white/30 rounded hover:bg-white/[0.08] transition cursor-pointer">
                    <Plus size={9} /> New
                  </button>
                  <button onClick={() => importInputRef.current?.click()}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] bg-white/[0.04] text-white/30 rounded hover:bg-white/[0.08] transition cursor-pointer">
                    <Upload size={9} /> Import
                  </button>
                  <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={importPatterns} />
                  {savedPatterns.length > 0 && (
                    <button onClick={() => exportPatterns(savedPatterns)}
                      className="flex items-center gap-1 px-2 py-1 text-[9px] bg-white/[0.04] text-white/30 rounded hover:bg-white/[0.08] transition cursor-pointer ml-auto">
                      <Download size={9} />
                    </button>
                  )}
                </div>

                {/* Save dialog */}
                {saveDialogOpen && (
                  <div className="p-2 border-b border-white/[0.06] bg-cyan-500/5">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={savePatternName}
                        onChange={e => setSavePatternName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') savePattern(savePatternName); if (e.key === 'Escape') setSaveDialogOpen(false) }}
                        placeholder="Pattern name..."
                        className="flex-1 bg-white/[0.06] text-cyan-400/80 text-[10px] px-2 py-1 rounded border border-white/[0.08] focus:outline-none focus:border-cyan-500/30 placeholder-white/15"
                        autoFocus
                      />
                      <button onClick={() => savePattern(savePatternName)}
                        className="px-2 py-1 text-[9px] bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition cursor-pointer">Save</button>
                      <button onClick={() => setSaveDialogOpen(false)}
                        className="px-2 py-1 text-[9px] text-white/30 hover:text-white/50 transition cursor-pointer">&times;</button>
                    </div>
                  </div>
                )}

                {/* Search */}
                {savedPatterns.length > 3 && (
                  <div className="p-2 border-b border-white/[0.06]">
                    <div className="relative">
                      <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/20" />
                      <input
                        type="text"
                        value={patternSearch}
                        onChange={e => setPatternSearch(e.target.value)}
                        placeholder="Search patterns..."
                        className="w-full bg-white/[0.04] text-cyan-400/80 text-[10px] pl-7 pr-3 py-1.5 rounded border border-white/[0.06] focus:outline-none focus:border-cyan-500/30 placeholder-white/15"
                      />
                    </div>
                  </div>
                )}

                {/* Pattern list */}
                <div className="flex-1 overflow-y-auto">
                  {filteredPatterns.length === 0 ? (
                    <div className="text-center text-[10px] text-white/15 py-8">
                      {patternSearch ? 'No matching patterns' : 'No saved patterns yet'}
                    </div>
                  ) : (
                    filteredPatterns.map(pat => (
                      <div key={pat.id} className="group border-b border-white/[0.04] px-2 py-2 hover:bg-white/[0.03] transition">
                        <div className="flex items-center justify-between">
                          {renamingId === pat.id ? (
                            <input
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') renamePattern(pat.id, renameValue); if (e.key === 'Escape') { setRenamingId(null); setRenameValue('') } }}
                              onBlur={() => { renamePattern(pat.id, renameValue) }}
                              className="flex-1 bg-white/[0.06] text-cyan-400/80 text-[10px] px-2 py-0.5 rounded border border-cyan-500/30 focus:outline-none"
                              autoFocus
                            />
                          ) : (
                            <span className="text-[10px] text-white/50 truncate flex-1 cursor-pointer" onClick={() => loadPattern(pat.code)}>
                              {pat.name}
                            </span>
                          )}
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                            <button onClick={() => loadPattern(pat.code)} title="Load"
                              className="p-1 text-white/20 hover:text-cyan-400 transition cursor-pointer"><Play size={9} /></button>
                            <button onClick={() => updatePattern(pat.id)} title="Update with current code"
                              className="p-1 text-white/20 hover:text-cyan-400 transition cursor-pointer"><Save size={9} /></button>
                            <button onClick={() => { setRenamingId(pat.id); setRenameValue(pat.name) }} title="Rename"
                              className="p-1 text-white/20 hover:text-white/40 transition cursor-pointer"><Pencil size={9} /></button>
                            <button onClick={() => duplicatePattern(pat)} title="Duplicate"
                              className="p-1 text-white/20 hover:text-white/40 transition cursor-pointer"><Files size={9} /></button>
                            <button onClick={() => exportSinglePattern(pat)} title="Export"
                              className="p-1 text-white/20 hover:text-white/40 transition cursor-pointer"><Download size={9} /></button>
                            <button onClick={() => deletePattern(pat.id)} title="Delete"
                              className="p-1 text-white/20 hover:text-red-400/60 transition cursor-pointer"><Trash2 size={9} /></button>
                          </div>
                        </div>
                        <div className="text-[8px] text-white/10 mt-0.5">
                          {new Date(pat.updatedAt).toLocaleDateString()} &middot; {pat.code.split('\n').length} lines
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {savedPatterns.length > 0 && (
                  <div className="px-3 py-1.5 border-t border-white/[0.06] flex items-center justify-between">
                    <span className="text-[9px] text-white/15">{savedPatterns.length} pattern{savedPatterns.length !== 1 ? 's' : ''}</span>
                    {!confirmDeleteAll ? (
                      <button onClick={() => setConfirmDeleteAll(true)}
                        className="text-[8px] text-white/10 hover:text-red-400/50 transition cursor-pointer">clear all</button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertTriangle size={9} className="text-red-400/50" />
                        <button onClick={deleteAllPatterns}
                          className="text-[8px] text-red-400/60 hover:text-red-400 transition cursor-pointer">confirm delete all</button>
                        <button onClick={() => setConfirmDeleteAll(false)}
                          className="text-[8px] text-white/20 hover:text-white/40 transition cursor-pointer">cancel</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ═══ LEARN PANEL ═══ */}
            {activePanel === 'learn' && (
              <div className="flex-1 overflow-y-auto p-3">
                <div className="space-y-4 text-[11px] text-white/40 leading-relaxed">
                  <div>
                    <h3 className="text-cyan-400/60 font-bold text-[10px] uppercase tracking-wider mb-2">Quick Start</h3>
                    <p className="mb-1"><span className="text-white/50">$:</span> starts a pattern line (auto-stacks)</p>
                    <p className="mb-1"><span className="text-white/50">s(&quot;bd sd hh cp&quot;)</span> — play samples in sequence</p>
                    <p className="mb-1"><span className="text-white/50">note(&quot;c4 e4 g4&quot;)</span> — play notes</p>
                    <p className="mb-1"><span className="text-white/50">.sound(&quot;piano&quot;)</span> — set instrument</p>
                  </div>
                  <div>
                    <h3 className="text-cyan-400/60 font-bold text-[10px] uppercase tracking-wider mb-2">Mini Notation</h3>
                    <p className="mb-1"><span className="text-white/50">[a b]</span> — group (subdivide)</p>
                    <p className="mb-1"><span className="text-white/50">a*4</span> — repeat 4x per cycle</p>
                    <p className="mb-1"><span className="text-white/50">&lt;a b c&gt;</span> — alternate each cycle</p>
                    <p className="mb-1"><span className="text-white/50">a(3,8)</span> — euclidean rhythm</p>
                    <p className="mb-1"><span className="text-white/50">~</span> — rest (silence)</p>
                  </div>
                  <div>
                    <h3 className="text-cyan-400/60 font-bold text-[10px] uppercase tracking-wider mb-2">Effects</h3>
                    <p className="mb-1"><span className="text-white/50">.lpf(800)</span> — low-pass filter</p>
                    <p className="mb-1"><span className="text-white/50">.room(0.5)</span> — reverb</p>
                    <p className="mb-1"><span className="text-white/50">.delay(0.5)</span> — delay</p>
                    <p className="mb-1"><span className="text-white/50">.gain(0.8)</span> — volume</p>
                    <p className="mb-1"><span className="text-white/50">.pan(0.3)</span> — stereo pan</p>
                    <p className="mb-1"><span className="text-white/50">.fast(2)</span> — speed up 2x</p>
                    <p className="mb-1"><span className="text-white/50">.slow(2)</span> — slow down 2x</p>
                    <p className="mb-1"><span className="text-white/50">.crush(4)</span> — bit crush</p>
                    <p className="mb-1"><span className="text-white/50">.shape(0.3)</span> — distortion</p>
                    <p className="mb-1"><span className="text-white/50">.vowel(&quot;a e i&quot;)</span> — formant filter</p>
                  </div>
                  <div>
                    <h3 className="text-cyan-400/60 font-bold text-[10px] uppercase tracking-wider mb-2">Modulation</h3>
                    <p className="mb-1"><span className="text-white/50">sine.range(200,2000)</span> — sine wave LFO</p>
                    <p className="mb-1"><span className="text-white/50">perlin.range(0,1)</span> — noise LFO</p>
                    <p className="mb-1"><span className="text-white/50">.fast(4)</span> — LFO speed</p>
                    <p className="mb-1"><span className="text-white/50">.slow(8)</span> — LFO slow</p>
                  </div>
                  <div>
                    <h3 className="text-cyan-400/60 font-bold text-[10px] uppercase tracking-wider mb-2">Shortcuts</h3>
                    <p className="mb-1"><span className="text-white/50">Spacebar</span> — Play / Pause</p>
                    <p className="mb-1"><span className="text-white/50">.</span> — Live Update</p>
                    <p className="mb-1 text-white/20">↑ when not typing in editor</p>
                    <p className="mb-1"><span className="text-white/50">Ctrl+Space</span> — Play / Pause</p>
                    <p className="mb-1"><span className="text-white/50">Ctrl+.</span> — Live Update</p>
                    <p className="mb-1 text-white/20">↑ while typing in editor</p>
                    <p className="mb-1"><span className="text-white/50">Ctrl+Z</span> — Undo</p>
                    <p className="mb-1"><span className="text-white/50">Ctrl+Shift+Z</span> — Redo</p>
                    <p className="mb-1"><span className="text-white/50">Tab</span> — Insert 2 spaces</p>
                  </div>

                </div>
              </div>
            )}

            {/* ═══ VIBE PANEL ═══ */}
            {activePanel === 'vibe' && (
              <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
                {/* Pulsing background orbs */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-cyan-500/[0.12] blur-[80px]" style={{ animation: 'vibePulse 4s ease-in-out infinite' }} />
                  <div className="absolute bottom-[20%] left-[15%] w-40 h-40 rounded-full bg-cyan-400/[0.08] blur-[60px]" style={{ animation: 'vibePulse 5s ease-in-out 1s infinite' }} />
                  <div className="absolute top-[55%] right-[10%] w-32 h-32 rounded-full bg-purple-500/[0.07] blur-[50px]" style={{ animation: 'vibePulse 6s ease-in-out 2s infinite' }} />
                  <div className="absolute top-[5%] left-[20%] w-20 h-20 rounded-full bg-cyan-300/[0.05] blur-[35px]" style={{ animation: 'vibePulse 7s ease-in-out 0.5s infinite' }} />
                </div>
                <style>{`@keyframes vibePulse { 0%, 100% { opacity: 0.4; transform: translate(-50%, 0) scale(1); } 50% { opacity: 1; transform: translate(-50%, 0) scale(1.35); } }`}</style>
                {/* Header — frosted glass */}
                <div className="px-3 py-2.5 relative z-10" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Zap size={14} className="text-cyan-400/80" />
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                    </div>
                    <span className="text-[11px] font-bold tracking-wider text-white/50 uppercase">Vibe with 444</span>
                  </div>
                </div>
                {/* Chat messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 relative z-10">
                  {vibeMessages.length === 0 && (
                    <div className="text-center py-8">
                      <div className="inline-block rounded-2xl px-6 py-6 mb-1" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px) saturate(1.3)', WebkitBackdropFilter: 'blur(20px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                        <div className="relative inline-block mb-3">
                          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.12)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 0 20px rgba(6,182,212,0.1)' }}>
                            <Zap size={22} className="text-cyan-400/60" />
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.15)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6,182,212,0.2)' }}>
                            <Sparkles size={10} className="text-cyan-400/70" />
                          </div>
                        </div>
                        <p className="text-[11px] text-white/40 font-medium">What do you want to create?</p>
                        <p className="text-[9px] text-white/20 mt-1">Describe a vibe, drop audio, or both</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-1.5 mt-3 px-4">
                        {['chill lofi beat', 'dark trap 808s', 'ambient drone', 'glitchy techno'].map(s => (
                          <button key={s} onClick={() => { setVibeInput(s); }} className="px-2.5 py-1 text-[8px] text-cyan-400/60 rounded-full hover:text-cyan-400/90 transition cursor-pointer" style={{ background: 'rgba(6,182,212,0.06)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(6,182,212,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>{s}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {vibeMessages.map((msg, i) => (
                    <div key={i} className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div
                        className={`inline-block max-w-[90%] px-3 py-2 text-[10px] ${
                          msg.role === 'user' ? 'text-cyan-300/90 rounded-2xl rounded-br-md' : 'text-white/60 rounded-2xl rounded-bl-md'
                        }`}
                        style={msg.role === 'user' ? {
                          background: 'rgba(6,182,212,0.1)',
                          backdropFilter: 'blur(16px) saturate(1.4)',
                          WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
                          border: '1px solid rgba(6,182,212,0.15)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(6,182,212,0.1)',
                        } : {
                          background: 'rgba(255,255,255,0.04)',
                          backdropFilter: 'blur(16px) saturate(1.3)',
                          WebkitBackdropFilter: 'blur(16px) saturate(1.3)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }}
                      >
                        {msg.role === 'ai' ? (
                          <div>
                            <pre className="whitespace-pre-wrap font-mono text-[9px] text-cyan-400/70 mb-2">{msg.text}</pre>
                            <div className="flex gap-1.5">
                              <button onClick={() => loadExample(msg.text)}
                                className="px-2 py-0.5 text-[8px] text-cyan-400/80 rounded-full hover:text-cyan-300 transition cursor-pointer" style={{ background: 'rgba(6,182,212,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6,182,212,0.15)' }}>LOAD</button>
                              <button onClick={() => addExample(msg.text)}
                                className="px-2 py-0.5 text-[8px] text-white/50 rounded-full hover:text-white/70 transition cursor-pointer" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>ADD</button>
                            </div>
                          </div>
                        ) : (
                          <span>{msg.text}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {vibeLoading && (
                    <div className="text-left">
                      <div className="inline-block px-3 py-2 rounded-2xl rounded-bl-md" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(16px) saturate(1.3)', WebkitBackdropFilter: 'blur(16px) saturate(1.3)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
                        <Loader2 size={12} className="animate-spin text-cyan-400/50" />
                      </div>
                    </div>
                  )}
                  <div ref={vibeEndRef} />
                </div>

                {/* Input — frosted glass bar */}
                <div className="p-2 relative z-10" style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px) saturate(1.2)', WebkitBackdropFilter: 'blur(16px) saturate(1.2)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  {/* Audio attachment preview */}
                  {vibeAudioFile && (
                    <div className="flex items-center gap-1.5 mb-1.5 px-2.5 py-1.5 rounded-xl text-[9px] text-cyan-400/70" style={{ background: 'rgba(6,182,212,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(6,182,212,0.12)' }}>
                      <Volume2 size={9} className="shrink-0" />
                      <span className="truncate flex-1">{vibeAudioFile.name}</span>
                      <span className="text-white/20 shrink-0">{(vibeAudioFile.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button onClick={() => setVibeAudioFile(null)} className="text-white/30 hover:text-red-400/60 transition cursor-pointer shrink-0">&times;</button>
                    </div>
                  )}
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => vibeAudioInputRef.current?.click()}
                      disabled={vibeLoading}
                      className="p-1.5 text-white/25 hover:text-cyan-400 rounded-lg transition disabled:opacity-30 cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                      title="Attach audio — Gemini will analyse it"
                    >
                      <Upload size={11} />
                    </button>
                    <input
                      ref={vibeAudioInputRef}
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={e => { if (e.target.files?.[0]) setVibeAudioFile(e.target.files[0]); e.target.value = '' }}
                    />
                    <input
                      type="text"
                      value={vibeInput}
                      onChange={e => setVibeInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') sendVibeMessage() }}
                      placeholder={vibeAudioFile ? 'Describe what to do with this audio...' : 'Describe a pattern...'}
                      className="flex-1 text-cyan-400/80 text-[10px] px-3 py-2 rounded-xl focus:outline-none placeholder-white/15"
                      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)' }}
                      disabled={vibeLoading}
                    />
                    <button
                      onClick={sendVibeMessage}
                      disabled={vibeLoading || (!vibeInput.trim() && !vibeAudioFile)}
                      className="p-1.5 text-cyan-400/80 rounded-lg hover:text-cyan-300 transition disabled:opacity-30 cursor-pointer" style={{ background: 'rgba(6,182,212,0.12)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(6,182,212,0.15)', boxShadow: '0 2px 8px rgba(6,182,212,0.1)' }}
                    >
                      <Send size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* ══════ SOUND UPLOADER MODAL ══════ */}
      {showSoundUploader && (
        <Suspense fallback={null}>
          <SoundUploader
            isOpen={showSoundUploader}
            onClose={() => setShowSoundUploader(false)}
            onRegisterSound={registerCustomSound}
          />
        </Suspense>
      )}

      {/* Release Pattern Modal — pre-fills with current editor code */}
      <ReleasePatternModal
        isOpen={showReleaseModal}
        onClose={() => setShowReleaseModal(false)}
        onSuccess={() => setShowReleaseModal(false)}
        initialCode={codeRef.current}
      />
    </div>
  )
}
