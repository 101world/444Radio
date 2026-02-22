'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Play, Square, Search, Zap, ChevronRight, Volume2, ChevronDown, Sparkles, Copy, Check, Palette, Plus, Undo2, Redo2, BookOpen, FolderOpen, Save, Download, Upload, Trash2, Pencil, Files, AlertTriangle, MessageCircle, Send, Loader2, Mic, CircleDot, LayoutGrid } from 'lucide-react'
import { lazy, Suspense } from 'react'
const NodeEditor = lazy(() => import('./NodeEditor'))

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
$: s("bd ~ [~ bd] ~, ~ cp ~ ~, [hh hh] [hh hh] [hh hh] [hh oh]")
  .bank("RolandTR808").gain(0.8)
$: note("<c3 a2 f2 g2>").sound("sawtooth")
  .lpf(600).gain(0.4).slow(2)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_synth_pad',
    name: 'ambient pad drift',
    code: `// ambient pad drift
$: note("<c3,e3,g3 a2,c3,e3 f2,a2,c3 g2,b2,d3>")
  .sound("sawtooth").lpf(sine.range(400,1500).slow(8))
  .room(0.9).roomsize(4).gain(0.35).slow(2)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_dnb_pattern',
    name: 'jungle breaks',
    code: `// jungle breaks
$: s("bd [~ bd] [~ bd:2] ~, ~ [~ cp] ~ cp, hh*8")
  .bank("RolandTR909").fast("<1 1 1.5 1>").gain(0.9)
$: note("<e2 [e2 g2] a2 [g2 ~]>")
  .sound("sawtooth").lpf(900).gain(0.5)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_techno_driver',
    name: 'techno 4/4',
    code: `// techno 4/4
$: s("bd*4").bank("RolandTR909").gain(1)
$: s("~ cp ~ cp").bank("RolandTR909").gain(0.7)
$: s("hh*8").gain("0.4 0.2 0.6 0.2 0.4 0.2 0.8 0.2")
  .bank("RolandTR909")
$: note("<c2 c2 [c2 c3] c2>").sound("sawtooth")
  .lpf(sine.range(200,3000).slow(16)).gain(0.5)`,
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
$: s("bd ~ ~ bd, ~ ~ cp ~, hh*4 [hh oh] hh*4 [hh oh]")
  .bank("RolandTR808").gain(0.85)
$: note("<c2 ~ [c2 c2] ~ , ~ eb2 ~ ~>")
  .sound("square").lpf(400).decay(0.3).gain(0.6)`,
    createdAt: 1732060800000,
    updatedAt: 1732060800000,
  },
  {
    id: 'default_euclidean',
    name: 'euclidean polyrhythm',
    code: `// euclidean polyrhythm
$: s("bd(3,8)").bank("RolandTR808").gain(0.9)
$: s("cp(2,5)").bank("RolandTR909").gain(0.6)
$: s("hh(5,8)").gain(0.4)
$: s("oh(3,8,2)").gain(0.3)`,
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
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.4 .7 .5 .8]")`,
      },
      {
        label: '808 Trap',
        code: `// 808 trap groove
$: s("bd ~ ~ bd ~ ~ bd ~")
  .bank("RolandTR808").gain(.9)
$: s("~ ~ ~ ~ ~ ~ ~ cp")
  .bank("RolandTR808").gain(.7)
$: s("hh*8").bank("RolandTR808")
  .gain("[.3 .6 .4 .8 .3 .7 .4 .9]")`,
      },
      {
        label: 'Boom Bap',
        code: `// boom bap classic
$: s("bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
$: s("~ sd ~ sd")
  .bank("RolandTR808").gain(.7)
$: s("[hh hh] [hh oh] [hh hh] [hh ~]")
  .bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'UK Garage',
        code: `// 2-step garage
$: s("bd ~ [~ bd] ~")
  .bank("RolandTR909").gain(.8)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[hh hh hh ~]*2")
  .bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'DnB Roller',
        code: `// drum and bass pattern
$: s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
$: s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
$: s("hh*8").gain("[.3 .6 .35 .7 .3 .6 .35 .8]")`,
      },
      {
        label: 'Clap Stack',
        code: `// layered clap patterns
$: s("bd*4").bank("RolandTR909").gain(.8)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.7)
$: s("~ ~ cp:2 ~").bank("RolandTR808").gain(.4)
$: s("[~ hh]*4").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Syncopated Claps',
        code: `// off-beat clap groove
$: s("bd ~ bd ~").bank("RolandTR808").gain(.8)
$: s("~ cp ~ [~ cp]").bank("RolandTR808")
  .gain(.65).room(.2)
$: s("[hh hh hh oh]*2")
  .bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Techno Driver',
        code: `// driving techno kick
$: s("bd*4").gain(.9)
$: s("~ ~ cp ~").gain(.5).room(.3)
$: s("[~ hh]*4").gain(.4)
$: s("~ ~ ~ oh").gain(.35)`,
      },
      {
        label: 'Euclidean Poly',
        code: `// euclidean polyrhythm
$: s("bd(3,8)").gain(.8)
$: s("cp(5,8)").gain(.5).room(.2)
$: s("hh(7,8)").gain(.4)
$: s("oh(2,8)").gain(.3)`,
      },
      {
        label: 'Afrobeat Poly',
        code: `// afrobeat polyrhythm
$: s("bd(3,8)").bank("RolandTR808").gain(.8)
$: s("rim(5,8)").bank("RolandTR808").gain(.45)
$: s("hh(7,16)").bank("RolandTR808")
  .gain("[.3 .5]*8")
$: s("cp(2,8)").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Reggaeton',
        code: `// dembow riddim
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.85)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
$: s("[hh hh]*4").gain("[.3 .5]*4")`,
      },
      {
        label: 'Chopped Breaks',
        code: `// chopped breakbeat
$: s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
$: s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)
$: s("hh*8")
  .gain("[.35 .6 .4 .7 .35 .6 .4 .75]")`,
      },
      {
        label: 'Minimal Click',
        code: `// minimal click hat groove
$: s("bd ~ ~ ~, ~ ~ bd ~").gain(.75)
$: s("~ rim ~ rim").gain(.3)
$: s("hh*16").gain("[.2 .35]*8")`,
      },
      {
        label: 'Stuttered Kick',
        code: `// rapid kick stutter
$: s("[bd bd ~] [~ bd bd] [bd ~ ~] [bd bd bd]")
  .gain(.8)
$: s("~ cp ~ ~").gain(.6)
$: s("[~ hh]*4").gain(.45)`,
      },
      {
        label: 'Rim Rider',
        code: `// rim-driven pattern
$: s("bd ~ ~ bd ~ bd ~ ~").gain(.8)
$: s("rim*8").gain("[.2 .4 .25 .5 .2 .45 .25 .55]")
$: s("~ ~ cp ~").gain(.55)`,
      },
      {
        label: 'Latin Clave',
        code: `// son clave rhythm
$: s("bd ~ ~ bd ~ bd ~ ~")
  .bank("RolandTR808").gain(.8)
$: s("rim ~ rim ~ ~ rim ~ ~")
  .bank("RolandTR808").gain(.4)
$: s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Clap Delay',
        code: `// echoing claps
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.6)
  .delay(.4).delayfeedback(.5)
  .room(.3)
$: s("[~ hh]*4").gain(.4)`,
      },
      {
        label: 'Triplet Hats',
        code: `// triplet hi-hat groove
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("hh*12").bank("RolandTR909")
  .gain("[.3 .2 .4]*4")`,
      },
      {
        label: 'Open Hat Groove',
        code: `// open hat accents
$: s("bd ~ bd ~").gain(.8)
$: s("~ sd ~ sd").gain(.65)
$: s("[hh hh oh ~]*2").gain(.5)
$: s("~ ~ ~ cp").gain(.4).room(.2)`,
      },
      {
        label: 'Double Clap',
        code: `// doubled clap hit
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ [cp cp] ~ ~").bank("RolandTR909")
  .gain(.6).room(.15)
$: s("hh*8").bank("RolandTR909")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")`,
      },
      {
        label: 'Shuffle Beat',
        code: `// shuffle groove
$: s("bd [~ bd] sd [~ bd]").bank("RolandTR909").gain(.8)
$: s("[hh hh hh]*2").bank("RolandTR909").gain("[.3 .5 .4]*2")`,
      },
      {
        label: 'Ghost Snare',
        code: `// ghost note snare
$: s("bd ~ sd ~").gain(.8)
$: s("~ [sd:3 ~] ~ [~ sd:3]").gain(.25).room(.2)
$: s("[~ hh]*4").gain(.4)`,
      },
      {
        label: 'Half-Time Feel',
        code: `// half-time groove
$: s("bd ~ ~ ~ bd ~ ~ ~").gain(.85)
$: s("~ ~ ~ ~ ~ ~ sd ~").gain(.7)
$: s("hh*8").gain("[.25 .4]*4")`,
      },
      {
        label: 'Breakcore Chop',
        code: `// breakcore stutter
$: s("[bd bd] [sd bd] [bd sd] [sd sd]").gain(.8)
$: s("hh*16").gain("[.2 .4 .3 .5]*4")
$: s("oh(3,8)").gain(.35)`,
      },
      {
        label: 'Jazz Brush',
        code: `// jazz brush feel
$: s("bd ~ [~ bd] ~").gain(.6)
$: s("~ rim ~ rim").gain(.3)
$: s("hh*8").gain("[.15 .25 .2 .3]*2")`,
      },
      {
        label: 'Riddim Shell',
        code: `// dancehall riddim
$: s("bd ~ bd ~").bank("RolandTR808").gain(.85)
$: s("~ ~ cp ~").bank("RolandTR808").gain(.6)
$: s("rim*8").bank("RolandTR808").gain("[.2 .35]*4")`,
      },
      {
        label: 'Marching',
        code: `// marching drum pattern
$: s("bd sd bd sd").gain(.75)
$: s("bd ~ ~ ~, ~ ~ bd ~").gain(.5)
$: s("[rim rim]*4").gain(.3)`,
      },
      {
        label: 'Lo-Fi Drums',
        code: `// dusty lo-fi drums
$: s("[bd:3 ~] [~ bd:3] ~ ~").gain(.4).lpf(800)
$: s("~ rim ~ rim").gain(.15).lpf(2000)
$: s("[~ hh:2]*4").gain("[.1 .2]*4").lpf(3500)`,
      },
      {
        label: 'Glitch Kick',
        code: `// glitchy kick pattern
$: s("bd").chop(16).speed("<1 2 .5 1.5>")
  .gain(.7)
$: s("~ cp ~ ~").gain(.5)`,
      },
      {
        label: 'Tribal Perc',
        code: `// tribal percussion
$: s("bd(3,8)").gain(.75)
$: s("rim(7,16)").gain(.35)
$: s("hh(5,8)").gain(.3)
$: s("oh(2,8)").gain(.25).room(.3)`,
      },
      {
        label: 'Jersey Club',
        code: `// jersey club bounce
$: s("bd bd [~ bd] bd bd [~ bd] bd [bd bd]")
  .bank("RolandTR808").gain(.85)
$: s("~ ~ cp ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.65)
$: s("hh*16").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]*4")
$: s("oh(3,16)").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Soca Riddim',
        code: `// soca carnival riddim
$: s("bd ~ bd ~").bank("RolandTR808").gain(.85)
$: s("~ cp ~ cp").bank("RolandTR808").gain(.65)
$: s("[hh hh hh hh]*4").bank("RolandTR808")
  .gain("[.25 .5 .3 .55]*4")
$: s("oh(2,8)").bank("RolandTR808").gain(.3)
$: s("rim(5,16)").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Footwork 160',
        code: `// footwork 160bpm feel
$: s("bd bd [~ bd] bd bd [~ bd] bd bd")
  .gain(.8).fast(1.25)
$: s("~ ~ ~ cp ~ ~ cp ~").gain(.6)
$: s("hh*16").gain("[.15 .3 .2 .35]*4")
$: s("oh(3,8)").gain(.25)
$: s("rim(5,16)").gain(.2)`,
      },
      {
        label: 'Bossa Nova',
        code: `// bossa nova pattern
$: s("bd ~ [~ bd] ~ bd ~ [~ bd] ~")
  .gain(.65)
$: s("rim ~ rim ~ rim ~ rim rim")
  .gain(.3)
$: s("[hh hh]*4").gain("[.15 .25]*4")
$: s("~ ~ ~ ~ ~ oh ~ ~").gain(.2)`,
      },
      {
        label: 'Jungle Amen',
        code: `// amen break style
$: s("[bd ~ bd ~] [~ sd ~ ~] [~ bd ~ ~] [~ sd bd sd]")
  .gain(.8)
$: s("hh*16").gain("[.2 .35 .25 .4]*4")
$: s("oh(2,16)").gain(.25).room(.2)
$: s("rim(3,16,2)").gain(.2)`,
      },
      {
        label: 'Industrial',
        code: `// industrial mechanical beat
$: s("bd*4").gain(.9).shape(.2)
$: s("~ sd ~ sd").gain(.7).crush(8)
$: s("hh*16").gain("[.2 .4]*8").crush(6)
$: s("oh(3,8)").gain(.3).room(.3)
$: s("rim*8").gain("[.15 .25]*4").lpf(2000)`,
      },
      {
        label: 'Grime',
        code: `// grime 140 pattern
$: s("bd ~ [bd ~] ~ bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
$: s("~ ~ ~ ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.7)
$: s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")
$: s("rim(3,8)").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Garage 2-Step',
        code: `// UK garage 2-step groove
$: s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[hh hh hh ~]*2").bank("RolandTR909").gain(.45)
$: s("oh ~ ~ ~").bank("RolandTR909").gain(.25)
$: s("rim(3,8,1)").bank("RolandTR909").gain(.2)`,
      },
      {
        label: 'Baltimore Club',
        code: `// baltimore club pattern
$: s("bd bd [~ bd] bd bd [~ bd] bd bd")
  .bank("RolandTR808").gain(.85)
$: s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.65)
$: s("hh*16").bank("RolandTR808")
  .gain("[.2 .3]*8")
$: s("cp(3,8,2)").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Neo Funk',
        code: `// neo funk drum groove
$: s("bd ~ [bd ~] ~ bd ~ ~ ~")
  .bank("RolandTR909").gain(.8)
$: s("~ sd ~ ~, ~ ~ ~ [~ sd]")
  .bank("RolandTR909").gain(.65)
$: s("[hh hh oh ~]*2").bank("RolandTR909").gain(.45)
$: s("rim(5,16)").bank("RolandTR909").gain(.2)
$: s("oh(2,8,3)").bank("RolandTR909").gain(.25)`,
      },
      {
        label: 'Lo-Fi Swing',
        code: `// lo-fi swing beat
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.4).lpf(800)
$: s("~ rim ~ rim").gain(.15).lpf(2000)
$: s("[hh:2 ~ hh:2 ~]*2")
  .gain("[.08 .15 .1 .2]*2").lpf(3500)
$: s("oh ~ ~ ~").gain(.1).lpf(2500)`,
      },
      {
        label: 'Amapiano Log',
        code: `// amapiano log drum pattern
$: s("bd ~ [~ bd] ~ bd ~ ~ ~")
  .bank("RolandTR808").gain(.75)
$: s("rim*8").bank("RolandTR808")
  .gain("[.15 .3 .2 .35 .15 .3 .2 .4]")
$: s("~ ~ cp ~").bank("RolandTR808").gain(.5)
$: s("hh*16").bank("RolandTR808").gain("[.1 .2]*8")`,
      },
      {
        label: 'UK Drill',
        code: `// UK drill pattern
$: s("bd ~ [~ bd] ~").gain(.85)
$: s("~ ~ ~ sd").gain(.7)
$: s("hh*8").gain("[.25 .5 .3 .6 .25 .55 .3 .65]")
$: s("oh(2,8,3)").gain(.25)
$: s("rim(3,16)").gain(.2)
$: s("~ ~ ~ [~ cp]").gain(.4)`,
      },
      {
        label: 'Cumbia Digital',
        code: `// digital cumbia groove
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.75)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.55)
$: s("[hh hh]*4").gain("[.25 .4]*4")
$: s("rim ~ rim ~ rim ~ rim ~").gain(.2)
$: s("oh ~ ~ ~ oh ~ ~ ~").gain(.2)`,
      },
      {
        label: 'Broken Beat',
        code: `// broken beat groove
$: s("bd ~ [~ bd] ~ [bd ~] ~ bd ~")
  .bank("RolandTR909").gain(.8)
$: s("~ ~ ~ sd ~ sd ~ ~")
  .bank("RolandTR909").gain(.65)
$: s("hh*16").bank("RolandTR909")
  .gain("[.2 .35]*8")
$: s("oh(2,8,5)").bank("RolandTR909").gain(.25)`,
      },
      {
        label: 'Electro Body',
        code: `// electro body music
$: s("bd*4").bank("RolandTR808").gain(.85)
$: s("~ cp ~ cp").bank("RolandTR808").gain(.6)
$: s("hh*16").bank("RolandTR808")
  .gain("[.15 .3]*8")
$: s("oh(3,8)").bank("RolandTR808").gain(.25)
$: s("rim(5,16,2)").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Cross Rhythm',
        code: `// african cross-rhythm
$: s("bd(3,8)").gain(.8)
$: s("rim(5,8)").gain(.35)
$: s("cp(2,8,3)").gain(.45)
$: s("hh(7,16)").gain("[.2 .35]*8")
$: s("oh(3,16,5)").gain(.2).room(.2)`,
      },
      {
        label: 'Polymetric 5/4',
        code: `// polymetric 5 over 4
$: s("bd(5,16)").gain(.8)
$: s("cp(4,16,2)").gain(.55)
$: s("hh(7,16)").gain(.35)
$: s("rim(3,16,1)").gain(.25)
$: s("oh(2,16,7)").gain(.2).room(.3)`,
      },
      {
        label: 'Drum Fill',
        code: `// drum fill sequence
$: s("bd sd bd sd bd [sd sd] [bd bd] [sd sd sd sd]")
  .bank("RolandTR909").gain(.75)
$: s("hh*16").bank("RolandTR909")
  .gain("[.2 .3 .25 .35]*4")
$: s("oh ~ ~ ~ oh ~ oh oh")
  .bank("RolandTR909").gain(.3)`,
      },
      {
        label: 'Layered Kit',
        code: `// layered multi-kit drums
$: s("bd*4").bank("RolandTR909").gain(.8)
$: s("bd*4").bank("RolandTR808").gain(.3)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("~ sd ~ ~").bank("RolandTR808").gain(.25)
$: s("[~ hh]*4").bank("RolandTR909").gain(.4)
$: s("hh*16").bank("RolandTR808").gain("[.1 .2]*8")`,
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
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.6).room(.3)`,
      },
      {
        label: 'Supersaw Arp',
        code: `// supersaw arpeggio
$: note("c3 e3 g3 b3 c4 b3 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(2500).room(.3)`,
      },
      {
        label: 'FM Bell',
        code: `// fm bell tones
$: note("<c5 e5 g5 b5>")
  .s("sine").gain(.4)
  .fmi(2).fmh(3)
  .room(.5).decay(.8)`,
      },
      {
        label: 'Pentatonic Pluck',
        code: `// pentatonic pluck riff
$: n("0 2 4 6 9 6 4 2")
  .scale("A3:minor pentatonic")
  .s("triangle").gain(.5)
  .decay(.2).lpf(3000)`,
      },
      {
        label: 'Piano Phase',
        code: `// piano phasing pattern
$: note("e4 g4 b4 d5 d5 g4 e4 d5 b4 g4 d5 d5")
  .s("piano").gain(.5).slow(2)`,
      },
      {
        label: 'Stacked Octaves',
        code: `// octave layering
$: note("<c3 e3 g3 b3>")
  .s("sawtooth").gain(.35)
  .add(note("<c4 e4 g4 b4>"))
  .lpf(2000).room(.3)`,
      },
      {
        label: 'Vibraphone Jazz',
        code: `// jazz vibraphone melody
$: note("g4 b4 d5 c5 a4 f4 g4 b4")
  .s("gm_vibraphone").velocity(.5)
  .room(.4).delay(.2)`,
      },
      {
        label: 'Music Box',
        code: `// delicate music box
$: note("c5 e5 g5 c6 g5 e5 c5 e5")
  .s("gm_music_box").velocity(.4)
  .room(.5).delay(.2).slow(2)`,
      },
      {
        label: 'Sine Lead',
        code: `// pure sine lead
$: note("c4 ~ e4 ~ g4 ~ b4 ~")
  .s("sine").gain(.5)
  .room(.3).delay(.15)`,
      },
      {
        label: 'Square Melody',
        code: `// retro square wave
$: note("a3 c4 e4 a4 g4 e4 c4 a3")
  .s("square").gain(.35)
  .lpf(1800).decay(.3)`,
      },
      {
        label: 'Flute Line',
        code: `// flute melody
$: note("d5 f5 a5 g5 f5 d5 c5 d5")
  .s("gm_flute").velocity(.5)
  .room(.4)`,
      },
      {
        label: 'Marimba Run',
        code: `// marimba scale run
$: n("0 1 2 3 4 5 6 7")
  .scale("D4:dorian")
  .s("gm_marimba").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Trill',
        code: `// rapid note trill
$: note("[c4 d4]*4")
  .s("piano").gain(.45)
  .room(.2)`,
      },
      {
        label: 'Descending Run',
        code: `// descending scale
$: n("7 6 5 4 3 2 1 0")
  .scale("A4:minor")
  .s("triangle").gain(.45)
  .lpf(2500)`,
      },
      {
        label: 'Chromatic Rise',
        code: `// chromatic ascent
$: note("c4 d4 d4 e4 e4 f4 g4 g4")
  .s("sawtooth").gain(.35)
  .lpf(2200).decay(.2)`,
      },
      {
        label: 'Harp Gliss',
        code: `// harp glissando
$: n("0 2 4 5 7 9 11 12")
  .scale("C4:major")
  .s("gm_harp").velocity(.45)
  .room(.5).slow(2)`,
      },
      {
        label: 'Random Notes',
        code: `// random note picker
$: n(irand(8).segment(8))
  .scale("A3:minor pentatonic")
  .s("piano").gain(.5)`,
      },
      {
        label: 'Delayed Lead',
        code: `// delay-soaked lead
$: note("c4 e4 g4 c5")
  .s("sine").gain(.45)
  .delay(.5).delayfeedback(.55)
  .room(.3)`,
      },
      {
        label: 'Xylophone',
        code: `// bright xylophone
$: note("e5 g5 a5 b5 a5 g5 e5 d5")
  .s("gm_xylophone").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Glide Saw',
        code: `// portamento sawtooth
$: note("c3 g3 e4 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35)
  .lpf(1500).glide(.1)`,
      },
      {
        label: 'Pizzicato',
        code: `// pizzicato strings
$: n("0 4 7 12 7 4 0 -5")
  .scale("A3:minor")
  .s("gm_pizzicato_strings").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Organ Lead',
        code: `// organ melody line
$: note("c4 d4 e4 f4 g4 f4 e4 d4")
  .s("gm_drawbar_organ").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Celesta',
        code: `// celesta sparkle
$: note("g5 a5 b5 d6 b5 a5 g5 g5")
  .s("gm_celesta").velocity(.4)
  .room(.5).delay(.2)`,
      },
      {
        label: 'Whistle',
        code: `// whistle melody
$: note("c5 d5 e5 g5 e5 d5 c5 a4")
  .s("gm_whistle").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Kalimba',
        code: `// kalimba thumb piano
$: n("0 2 4 7 9 7 4 2")
  .scale("C5:major pentatonic")
  .s("gm_kalimba").velocity(.5)
  .room(.4)`,
      },
      {
        label: 'Recorder',
        code: `// gentle recorder
$: note("f4 g4 a4 c5 a4 g4 f4 e4")
  .s("gm_recorder").velocity(.4)
  .room(.3)`,
      },
      {
        label: 'Synth Brass',
        code: `// synth brass lead
$: note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_synth_brass1").velocity(.5)
  .lpf(2500)`,
      },
      {
        label: 'Arp Up Down',
        code: `// arp up and down
$: n("0 2 4 7 9 12 9 7 4 2 0 -3")
  .scale("A2:minor pentatonic")
  .s("sawtooth").gain(.35)
  .lpf(2000).room(.3)`,
      },
      {
        label: 'Pan Flute',
        code: `// pan flute line
$: note("e4 g4 a4 b4 d5 b4 a4 g4")
  .s("gm_pan_flute").velocity(.45)
  .room(.4)`,
      },
      {
        label: 'Trumpet Line',
        code: `// trumpet melody
$: note("c4 e4 g4 c5 ~ g4 e4 c4")
  .s("gm_trumpet").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Oboe Nocturne',
        code: `// oboe nocturne melody
$: note("d4 f4 a4 g4 f4 e4 d4 c4 d4 f4 a4 c5 a4 g4 f4 d4")
  .s("gm_oboe").velocity(.45)
  .room(.5).delay(.2).slow(2)`,
      },
      {
        label: 'Clarinet Jazz',
        code: `// jazz clarinet run
$: note("c4 d4 e4 f4 g4 b4 c5 b4 g4 f4 e4 d4 c4 b3 g3 c4")
  .s("gm_clarinet").velocity(.45)
  .room(.4).slow(2)`,
      },
      {
        label: 'Banjo Bluegrass',
        code: `// bluegrass banjo roll
$: note("c4 e4 g4 c5 e4 g4 c5 e5 c5 g4 e4 c4 g3 c4 e4 g4")
  .s("gm_banjo").velocity(.5)
  .room(.25).slow(2)`,
      },
      {
        label: 'Shakuhachi Zen',
        code: `// zen shakuhachi melody
$: note("d4 ~ f4 ~ a4 ~ g4 ~ f4 ~ d4 ~ c4 ~ d4 ~")
  .s("gm_shakuhachi").velocity(.4)
  .room(.6).delay(.3).delayfeedback(.4).slow(2)`,
      },
      {
        label: 'Sitar Raga',
        code: `// sitar raga phrase
$: note("c4 d4 e4 f4 g4 a4 b4 c5 b4 a4 g4 f4 e4 d4 c4 d4")
  .s("gm_sitar").velocity(.45)
  .room(.4).slow(2)`,
      },
      {
        label: 'Accordion Waltz',
        code: `// accordion waltz melody
$: note("c4 e4 g4 e4 c4 g3 c4 e4 f4 a4 c5 a4 f4 c4 f4 a4")
  .s("gm_accordion").velocity(.4)
  .room(.3).slow(2)`,
      },
      {
        label: 'Harmonica Blues',
        code: `// blues harmonica riff
$: note("c4 e4 f4 g4 g4 ~ b4 g4 f4 e4 c4 ~ b3 c4 e4 ~")
  .s("gm_harmonica").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Ocarina Dreamy',
        code: `// dreamy ocarina melody
$: note("e4 g4 a4 b4 d5 b4 a4 g4 e4 d4 e4 g4 a4 e4 d4 e4")
  .s("gm_ocarina").velocity(.4)
  .room(.5).delay(.25).delayfeedback(.35).slow(2)`,
      },
      {
        label: 'Steel Drum Island',
        code: `// island steel drum melody
$: note("c4 e4 g4 c5 a4 g4 e4 c4 d4 f4 a4 d5 c5 a4 f4 d4")
  .s("gm_steel_drum").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Glockenspiel Frost',
        code: `// frosty glockenspiel
$: note("c5 d5 e5 g5 a5 g5 e5 d5 c5 e5 g5 c6 g5 e5 d5 c5")
  .s("gm_glockenspiel").velocity(.4)
  .room(.5).delay(.2).slow(2)`,
      },
      {
        label: 'Dulcimer Dance',
        code: `// dulcimer folk dance
$: note("c4 d4 e4 g4 a4 g4 e4 d4 c4 e4 g4 a4 c5 a4 g4 e4")
  .s("gm_dulcimer").velocity(.45)
  .room(.35).slow(2)`,
      },
      {
        label: 'Piccolo Flight',
        code: `// piccolo flight melody
$: note("g5 a5 b5 d6 c6 b5 a5 g5 f5 g5 a5 c6 b5 a5 g5 f5")
  .s("gm_piccolo").velocity(.4)
  .room(.35).slow(2)`,
      },
      {
        label: 'Cello Sorrow',
        code: `// sorrowful cello line
$: note("c3 d3 e3 g3 f3 e3 d3 c3 b2 c3 d3 f3 e3 d3 c3 b2")
  .s("gm_cello").velocity(.45)
  .room(.5).slow(4)`,
      },
      {
        label: 'Violin Soaring',
        code: `// soaring violin melody
$: note("g4 a4 b4 d5 e5 d5 b4 a4 g4 b4 d5 g5 d5 b4 a4 g4")
  .s("gm_violin").velocity(.45)
  .room(.5).delay(.15).slow(2)`,
      },
      {
        label: 'Koto Garden',
        code: `// japanese koto garden
$: note("c4 d4 f4 g4 a4 ~ c5 a4 g4 f4 d4 c4 ~ d4 f4 ~")
  .s("gm_koto").velocity(.4)
  .room(.5).delay(.25).delayfeedback(.35).slow(2)`,
      },
      {
        label: 'Alto Sax Smooth',
        code: `// smooth alto saxophone
$: note("c4 d4 e4 g4 f4 e4 d4 c4 b3 c4 d4 f4 e4 d4 c4 b3")
  .s("gm_alto_sax").velocity(.45)
  .room(.4).slow(2)`,
      },
      {
        label: 'FM Glass',
        code: `// FM glass bell tones
$: note("c5 e5 g5 b5 c6 b5 g5 e5 d5 f5 a5 c6 a5 f5 d5 c5")
  .s("sine").gain(.4)
  .fmi(3).fmh(5)
  .room(.5).delay(.2).slow(2)`,
      },
      {
        label: 'Bagpipe March',
        code: `// bagpipe march melody
$: note("c4 d4 e4 g4 a4 g4 e4 d4 c4 d4 e4 g4 c5 g4 e4 d4")
  .s("gm_bagpipe").velocity(.4)
  .room(.4).slow(2)`,
      },
      {
        label: 'Dual Melody',
        code: `// dual interweaving melodies
$: note("c4 ~ e4 ~ g4 ~ b4 ~")
  .s("gm_flute").velocity(.4)
  .room(.4)
$: note("~ g3 ~ b3 ~ d4 ~ f4")
  .s("gm_clarinet").velocity(.35)
  .room(.35)`,
      },
      {
        label: 'Scale Explorer',
        code: `// whole tone scale explorer
$: n("0 1 2 3 4 5 4 3 2 1 0 1 2 3 4 5")
  .scale("C4:major")
  .s("gm_vibraphone").velocity(.45)
  .room(.4).delay(.15).slow(2)`,
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
$: note("<c2 c2 f2 g2>")
  .s("sine").gain(.6)
  .lpf(200).shape(.15)`,
      },
      {
        label: 'Acid 303',
        code: `// acid bassline
$: note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.55)
  .lpf(sine.range(400,3000))
  .lpq(12).decay(.15)`,
      },
      {
        label: 'Reese Bass',
        code: `// thick reese bass
$: note("<c1 c1 e1 f1>")
  .s("sawtooth").gain(.5)
  .lpf(500).shape(.3)`,
      },
      {
        label: 'DnB Jump',
        code: `// jumping dnb bass
$: note("[c2 ~] [~ g2] [e2 ~] [~ c2]")
  .s("sawtooth").gain(.55)
  .lpf(800).shape(.2)`,
      },
      {
        label: 'Wobble',
        code: `// wobble bass
$: note("c2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .lpq(8)`,
      },
      {
        label: 'Funk Slap',
        code: `// funky slap bass
$: note("c2 ~ g2 ~ a2 ~ g2 e2")
  .s("square").gain(.5)
  .lpf(1200).decay(.12)`,
      },
      {
        label: 'Sub Pulse',
        code: `// pulsing sub
$: note("c1*4").s("sine")
  .gain("[.4 .6 .5 .7]")
  .lpf(120)`,
      },
      {
        label: 'Octave Jump',
        code: `// octave-jumping bass
$: note("c2 c3 c2 c3 e2 e3 g2 g3")
  .s("sawtooth").gain(.45)
  .lpf(1000).decay(.15)`,
      },
      {
        label: 'FM Bass',
        code: `// fm deep bass
$: note("<c2 f2 g2 e2>")
  .s("sine").gain(.5)
  .fmi(1).fmh(2)
  .lpf(300)`,
      },
      {
        label: 'Dub Bass',
        code: `// dub reggae bass
$: note("c2 ~ ~ c2 ~ ~ e2 ~")
  .s("sine").gain(.55)
  .lpf(300).shape(.2)
  .room(.3)`,
      },
      {
        label: 'Pluck Bass',
        code: `// plucked bass
$: note("c2 e2 g2 c3")
  .s("triangle").gain(.5)
  .decay(.1).lpf(1500)`,
      },
      {
        label: 'Distorted Sub',
        code: `// distorted sub bass
$: note("<c1 e1 f1 g1>")
  .s("sine").gain(.5)
  .shape(.5).lpf(250)`,
      },
      {
        label: 'Glide Bass',
        code: `// sliding bassline
$: note("c2 g2 e2 c2")
  .s("sawtooth").gain(.45)
  .glide(.15).lpf(900)`,
      },
      {
        label: 'Pulse Width',
        code: `// pulse width bass
$: note("<c2 f2 e2 g2>")
  .s("square").gain(.45)
  .pw(sine.range(.1,.9).slow(4))
  .lpf(800)`,
      },
      {
        label: 'Stab Bass',
        code: `// short stab bass
$: note("c2 ~ ~ c2 e2 ~ ~ ~")
  .s("sawtooth").gain(.5)
  .decay(.08).lpf(1200)`,
      },
      {
        label: 'Rolling Bass',
        code: `// rolling eighth bass
$: note("c2 c2 e2 e2 f2 f2 g2 g2")
  .s("sine").gain(.5)
  .lpf(400).shape(.15)`,
      },
      {
        label: 'Detuned Bass',
        code: `// detuned thick bass
$: note("<c2 f2 g2 e2>")
  .s("sawtooth").gain(.4)
  .detune(12).lpf(700)`,
      },
      {
        label: 'Synth Bass',
        code: `// synth bass riff
$: note("c2 ~ e2 c2 g1 ~ c2 ~")
  .s("square").gain(.45)
  .lpf(sine.range(500,1500))
  .decay(.15)`,
      },
      {
        label: 'Filtered Sub',
        code: `// filter sweep sub
$: note("c1*2").s("sine").gain(.55)
  .lpf(sine.range(80,300).slow(8))
  .shape(.2)`,
      },
      {
        label: 'Trap 808',
        code: `// long 808 bass
$: note("c1 ~ ~ ~ e1 ~ ~ ~")
  .s("sine").gain(.6)
  .decay(1).lpf(200)
  .shape(.25)`,
      },
      {
        label: 'Squelch Bass',
        code: `// squelchy acid bass
$: note("c2 c2 [c2 e2] c2")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,2500).fast(2))
  .lpq(15).decay(.12)`,
      },
      {
        label: 'Finger Bass',
        code: `// finger bass pluck
$: note("c2 ~ g2 ~ a2 ~ g2 e2")
  .s("gm_electric_bass_finger").velocity(.55)`,
      },
      {
        label: 'Fretless Bass',
        code: `// fretless smooth
$: note("c2 d2 e2 f2 g2 f2 e2 d2")
  .s("gm_fretless_bass").velocity(.5)
  .room(.2)`,
      },
      {
        label: 'Slap Pick',
        code: `// slap bass pick
$: note("c2 ~ c2 g2 ~ g2 b2 ~")
  .s("gm_slap_bass1").velocity(.55)`,
      },
      {
        label: 'Chorus Bass',
        code: `// chorus detuned bass
$: note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.4)
  .detune(15).lpf(600)
  .room(.2)`,
      },
      {
        label: 'Muted Bass',
        code: `// muted staccato
$: note("c2 c2 ~ c2 e2 e2 ~ e2")
  .s("triangle").gain(.5)
  .decay(.05).lpf(800)`,
      },
      {
        label: 'Portamento Bass',
        code: `// sliding bass
$: note("c2 e2 g2 c3 g2 e2")
  .s("sine").gain(.5)
  .glide(.2).lpf(400)`,
      },
      {
        label: 'Phat Sub',
        code: `// phat layered sub
$: note("<c1 e1 f1 g1>")
  .s("sine").gain(.55)
  .shape(.3).lpf(150)
$: note("<c2 e2 f2 g2>")
  .s("triangle").gain(.25)
  .lpf(500)`,
      },
      {
        label: 'Arpeggio Bass',
        code: `// arpeggiated bass
$: note("c2 g2 e2 g2 c2 b1 e2 b1")
  .s("sawtooth").gain(.45)
  .lpf(1200).decay(.1)`,
      },
      {
        label: 'Sine Kick Bass',
        code: `// kick-like sine bass
$: note("c1*4").s("sine")
  .gain(.6).decay(.3)
  .lpf(100).shape(.4)`,
      },
      {
        label: 'Funk Thumb',
        code: `// funk thumb bass groove
$: note("c2 ~ c2 g2 ~ g2 b2 c3 c2 ~ e2 c2 g1 ~ c2 ~")
  .s("gm_electric_bass_finger").velocity(.55)
  .room(.2).slow(2)`,
      },
      {
        label: 'Reggae Offbeat',
        code: `// reggae offbeat bass
$: note("~ c2 ~ c2 ~ e2 ~ c2 ~ c2 ~ g2 ~ f2 ~ c2")
  .s("sine").gain(.55)
  .lpf(300).shape(.2).slow(2)`,
      },
      {
        label: 'Prog Sequence',
        code: `// progressive bass sequence
$: note("c2 d2 e2 f2 g2 a2 b2 c3 b2 a2 g2 f2 e2 d2 c2 g1")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(400,1500).slow(8))
  .room(.2).slow(2)`,
      },
      {
        label: 'Disco Octave',
        code: `// disco octave bass
$: note("c2 c3 c2 c3 f2 f3 f2 f3 g2 g3 g2 g3 b2 b3 b2 b3")
  .s("square").gain(.45)
  .lpf(1200).decay(.1).slow(2)`,
      },
      {
        label: 'Electro Pulse',
        code: `// electro synth bass pulse
$: note("c2 c2 [c2 e2] c2 c2 [c2 g2] c2 c2")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,2000).fast(2))
  .lpq(8).shape(.15)`,
      },
      {
        label: 'Motown Walking',
        code: `// motown walking bass
$: note("c2 d2 e2 f2 g2 a2 b2 c3 g2 f2 e2 d2 c2 b1 a1 g1")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.2).slow(2)`,
      },
      {
        label: 'Neuro Riff',
        code: `// neuro bass riff
$: note("c1 c1 [e1 c1] g1 c1 c1 [f1 e1] c1")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,3000).fast(4))
  .lpq(12).shape(.3).crush(12)`,
      },
      {
        label: 'Latin Bass',
        code: `// latin bass montuno
$: note("c2 ~ e2 c2 g2 ~ c2 ~ f2 ~ a2 f2 c3 ~ f2 ~")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.2).slow(2)`,
      },
      {
        label: 'Deep Dub',
        code: `// deep dub bass drop
$: note("c2 ~ ~ c2 ~ ~ e2 ~ ~ ~ g2 ~ ~ ~ c2 ~")
  .s("sine").gain(.6)
  .lpf(250).shape(.25)
  .room(.4).delay(.4).delayfeedback(.5).slow(2)`,
      },
      {
        label: 'Synth Bass Arp',
        code: `// synth bass arpeggio
$: note("c2 g2 e2 g2 c3 g2 e2 c2 b1 f2 d2 f2 b2 f2 d2 b1")
  .s("square").gain(.45)
  .lpf(1500).decay(.1).slow(2)`,
      },
      {
        label: 'Picked Electric',
        code: `// electric bass picked
$: note("c2 c2 g2 g2 a2 a2 g2 e2")
  .s("gm_electric_bass_pick").velocity(.55)`,
      },
      {
        label: 'Fretless Glide',
        code: `// fretless gliding bass
$: note("c2 d2 e2 g2 a2 g2 e2 d2 c2 b1 a1 b1 c2 e2 g2 c3")
  .s("gm_fretless_bass").velocity(.5)
  .glide(.1).room(.25).slow(2)`,
      },
      {
        label: 'Dubstep Half',
        code: `// dubstep half-time bass
$: note("c1 ~ ~ ~ ~ ~ ~ ~ e1 ~ ~ ~ ~ ~ ~ ~")
  .s("sawtooth").gain(.55)
  .lpf(sine.range(100,2500).fast(4))
  .lpq(10).shape(.3).slow(2)`,
      },
      {
        label: 'Trance Pulse',
        code: `// trance bass pulse
$: note("c2 c2 c2 c2 c2 c2 c2 c2")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(300,1500).slow(8))
  .decay(.1).shape(.15)`,
      },
      {
        label: 'Hip-Hop 808 Slide',
        code: `// hip-hop 808 slide
$: note("c1 ~ ~ ~ e1 ~ c1 ~")
  .s("sine").gain(.6)
  .glide(.15).decay(.8)
  .lpf(180).shape(.3)`,
      },
      {
        label: 'Jazz Walking',
        code: `// jazz walking bass line
$: note("c2 e2 g2 a2 b2 a2 g2 e2 f2 a2 c3 d3 c3 a2 f2 c2")
  .s("gm_acoustic_bass").velocity(.5)
  .room(.3).slow(2)`,
      },
      {
        label: 'Techno Acid Long',
        code: `// long acid techno bass
$: note("c2 [~ c2] e2 [c2 g1] f2 [~ f2] e2 [c2 b1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(300,4000).fast(2))
  .lpq(14).decay(.12)`,
      },
      {
        label: 'Choir Sub',
        code: `// choir sub layer bass
$: note("<c2 a1 b1 g1>")
  .s("sine").gain(.55)
  .lpf(200).shape(.2).slow(2)
$: note("<c3 a2 b2 g2>")
  .s("triangle").gain(.2)
  .lpf(600).slow(2)`,
      },
      {
        label: 'Multi-Octave Bass',
        code: `// multi-octave bass riff
$: note("c1 c2 c3 c2 e1 e2 e3 e2 f1 f2 f3 f2 g1 g2 g3 g2")
  .s("sawtooth").gain(.4)
  .lpf(1000).decay(.1).slow(2)`,
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
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("supersaw").gain(.35)
  .lpf(2000).room(.4).slow(2)`,
      },
      {
        label: 'Piano Chords',
        code: `// smooth piano chords
$: note("<[c3,e3,g3,b3] [f3,a3,c4] [g3,b3,d4] [e3,g3,b3]>")
  .s("piano").gain(.5).room(.3).slow(2)`,
      },
      {
        label: 'Rhodes Chords',
        code: `// electric piano rhodes
$: note("<[e3,g3,b3] [a3,c4,e4] [b3,d4,f4] [g3,b3,d4]>")
  .s("gm_epiano1").velocity(.4)
  .room(.4).slow(2)`,
      },
      {
        label: 'Ambient Pad',
        code: `// ambient wash pad
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.7).roomsize(5)
  .lpf(1500).slow(4)`,
      },
      {
        label: 'Chord Stabs',
        code: `// rhythmic chord stabs
$: note("[c3,e3,g3] ~ [a2,c3,e3] ~")
  .s("supersaw").gain(.4)
  .lpf(2500).decay(.15)`,
      },
      {
        label: 'Jazz Voicings',
        code: `// jazz chord voicings
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("piano").gain(.45).room(.3).slow(2)`,
      },
      {
        label: 'Organ Chords',
        code: `// organ chord progression
$: note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("gm_organ1").velocity(.4)
  .room(.3).slow(2)`,
      },
      {
        label: 'Vowel Pad',
        code: `// vowel-like pad
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("sawtooth").gain(.3)
  .vowel("<a e i o>")
  .room(.5).slow(4)`,
      },
      {
        label: 'String Pad',
        code: `// orchestral strings
$: note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_strings1").velocity(.4)
  .room(.4).slow(4)`,
      },
      {
        label: 'Drone',
        code: `// deep drone pad
$: note("[c2,g2,c3]")
  .s("sawtooth").gain(.25)
  .lpf(400).room(.8).roomsize(6)`,
      },
      {
        label: 'Minor 7th Stack',
        code: `// stacked minor 7ths
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a3,c4,e4,g4]>")
  .s("supersaw").gain(.3)
  .lpf(1800).room(.4).slow(2)`,
      },
      {
        label: 'Bright Saw Chords',
        code: `// bright sawtooth chords
$: note("<[c4,e4,g4] [f4,a4,c5] [g4,b4,d5] [c4,e4,g4]>")
  .s("sawtooth").gain(.35)
  .lpf(3000).room(.3)`,
      },
      {
        label: 'Power Chords',
        code: `// synth power chords
$: note("<[c2,g2,c3] [b1,f2,b2] [a1,e2,a2] [b1,f2,b2]>")
  .s("sawtooth").gain(.4)
  .lpf(1200).shape(.15).slow(2)`,
      },
      {
        label: 'Pluck Chords',
        code: `// plucked chord stabs
$: note("[c4,e4,g4] ~ ~ [a3,c4,e4]")
  .s("triangle").gain(.45)
  .decay(.2).room(.3)`,
      },
      {
        label: 'Wide Stereo Pad',
        code: `// stereo-wide pad
$: note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("supersaw").gain(.3)
  .pan(sine.range(.2,.8).slow(8))
  .room(.5).slow(4)`,
      },
      {
        label: 'Glass Pad',
        code: `// glassy bell pad
$: note("<[c4,e4,g4,b4] [a3,c4,e4,g4]>")
  .s("sine").gain(.35)
  .fmi(1).fmh(5)
  .room(.6).slow(4)`,
      },
      {
        label: 'Detune Wash',
        code: `// detuned wash
$: note("<[c3,e3,g3]>")
  .s("sawtooth").gain(.3)
  .detune(15).lpf(1500)
  .room(.6).roomsize(4)`,
      },
      {
        label: 'Choir Pad',
        code: `// choir aahs pad
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.5).slow(2)`,
      },
      {
        label: 'Maj7 Shimmer',
        code: `// shimmering major 7th
$: note("<[c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("supersaw").gain(.3)
  .lpf(2200).delay(.3)
  .delayfeedback(.4).room(.4).slow(4)`,
      },
      {
        label: 'Suspended Pad',
        code: `// suspended chord pad
$: note("<[c3,f3,g3] [a2,d3,e3]>")
  .s("sine").gain(.35)
  .room(.6).roomsize(4)
  .lpf(1200).slow(4)`,
      },
      {
        label: 'Wurlitzer',
        code: `// wurlitzer chords
$: note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("gm_epiano2").velocity(.4)
  .room(.3).slow(2)`,
      },
      {
        label: 'Nylon Guitar Chords',
        code: `// acoustic guitar chords
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Harpsichord',
        code: `// harpsichord arpeggiated
$: note("<[c3,e3,g3] [d3,f3,a3] [e3,g3,b3] [c3,e3,g3]>")
  .s("gm_harpsichord").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Dim7 Tension',
        code: `// diminished 7th tension
$: note("<[c3,e3,g3,a3] [d3,f3,a3,b3]>")
  .s("piano").gain(.45)
  .room(.4).slow(2)`,
      },
      {
        label: 'Stack 5ths',
        code: `// stacked fifths
$: note("<[c3,g3,d4] [b2,f3,c4] [a2,e3,b3] [b2,f3,c4]>")
  .s("supersaw").gain(.3)
  .lpf(1800).room(.4).slow(2)`,
      },
      {
        label: 'Tremolo Pad',
        code: `// tremolo chord pad
$: note("[c3,e3,g3]*4")
  .s("sine").gain(sine.range(.15,.4).fast(6))
  .room(.5)`,
      },
      {
        label: 'Brass Stabs',
        code: `// brass chord stabs
$: note("[c3,e3,g3] ~ ~ [a2,c3,e3]")
  .s("gm_brass1").velocity(.5)
  .decay(.2)`,
      },
      {
        label: 'Reverse Pad',
        code: `// reverse swell pad
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).attack(.8)
  .room(.5).slow(4)`,
      },
      {
        label: 'Bell Chords',
        code: `// bell-like chords
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("sine").gain(.35)
  .fmi(2).fmh(5)
  .room(.5).slow(2)`,
      },
      {
        label: 'Dark Minor',
        code: `// dark minor progression
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("sawtooth").gain(.3)
  .lpf(1200).room(.4).slow(2)`,
      },
      {
        label: 'Gospel Chords',
        code: `// gospel piano chords
$: note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,g3,a3,c4] [g3,b3,d4,f4]>")
  .s("piano").gain(.5).room(.4).slow(2)
$: note("<c2 f2 d2 g2>")
  .s("gm_acoustic_bass").velocity(.4).slow(2)`,
      },
      {
        label: 'Neo Soul Chords',
        code: `// neo soul extended chords
$: note("<[d3,g3,a3,c4,e4] [g3,b3,d4,f4,a4] [c3,e3,g3,b3,d4] [a2,d3,e3,g3,b3]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)
$: note("<d2 g2 c2 a1>")
  .s("sine").gain(.4).lpf(200).slow(2)`,
      },
      {
        label: 'Synth Choir Pad',
        code: `// synth choir pad wash
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_synth_choir").velocity(.35)
  .room(.6).roomsize(5).slow(2)
$: note("<[c4,e4,g4]>")
  .s("gm_synth_choir").velocity(.2)
  .room(.7).slow(4)`,
      },
      {
        label: 'Augmented Shimmer',
        code: `// augmented chord shimmer
$: note("<[c3,e3,a3] [a2,c3,e3] [e3,a3,c4] [c3,e3,a3]>")
  .s("supersaw").gain(.3)
  .lpf(2200).delay(.3).delayfeedback(.4)
  .room(.5).slow(2)`,
      },
      {
        label: 'Warm Pad Layers',
        code: `// layered warm pad
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("gm_warm_pad").velocity(.3)
  .room(.6).slow(4)
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("sine").gain(.2)
  .room(.5).slow(4)`,
      },
      {
        label: 'R&B 9th Chords',
        code: `// R&B 9th chord voicings
$: note("<[e3,g3,b3,d4,f4] [a3,c4,e4,g4,b4] [b3,d4,f4,a4,c5] [g3,b3,d4,f4,a4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)`,
      },
      {
        label: 'Cinematic Strings',
        code: `// cinematic string pad
$: note("<[c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d3,f3,b3] [g2,b2,d3,g3]>")
  .s("gm_strings1").velocity(.4)
  .room(.5).slow(4)
$: note("<[c4,e4,g4]>")
  .s("gm_strings2").velocity(.25)
  .room(.6).slow(4)`,
      },
      {
        label: 'Lydian Float',
        code: `// lydian floating pad
$: note("<[c3,e3,g3,b3] [g2,b2,d3,g3]>")
  .s("supersaw").gain(.3)
  .lpf(2000).room(.5)
  .delay(.3).delayfeedback(.4).slow(4)`,
      },
      {
        label: 'Clavichord Pluck',
        code: `// plucked clavichord chords
$: note("<[c3,e3,g3] [f3,a3,c4] [d3,f3,a3] [g3,b3,d4]>")
  .s("gm_clavichord").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Bandcamp Synth',
        code: `// detuned synth pad
$: note("<[c3,e3,g3] [f3,a3,c4] [b2,d3,f3] [e3,g3,b3]>")
  .s("sawtooth").gain(.3)
  .detune(20).lpf(1800)
  .room(.5).slow(2)
$: note("<[c4,e4,g4]>")
  .s("triangle").gain(.15)
  .room(.4).slow(4)`,
      },
      {
        label: 'Church Organ',
        code: `// church organ chords
$: note("<[c3,e3,g3,c4] [f3,a3,c4,f4] [g3,b3,d4,g4] [c3,e3,g3,c4]>")
  .s("gm_church_organ").velocity(.4)
  .room(.7).roomsize(6).slow(2)`,
      },
      {
        label: 'Bright Poly',
        code: `// bright polysynth chords
$: note("<[c4,e4,g4,b4] [f4,a4,c5,e5] [g4,b4,d5,f5] [c4,e4,g4,b4]>")
  .s("gm_polysynth").velocity(.35)
  .room(.4).slow(2)`,
      },
      {
        label: 'Halo Ambient',
        code: `// halo ambient pad
$: note("<[c3,g3,c4] [a2,e3,a3] [b2,f3,b3] [g2,d3,g3]>")
  .s("gm_halo_pad").velocity(.3)
  .room(.7).roomsize(5).slow(4)`,
      },
      {
        label: 'Crystal Shimmer',
        code: `// crystal shimmer chords
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_crystal").velocity(.35)
  .room(.6).delay(.3).delayfeedback(.45).slow(4)`,
      },
      {
        label: 'Accordion Folk',
        code: `// folk accordion chords
$: note("<[c3,e3,g3] [f3,a3,c4] [g3,b3,d4] [c3,e3,g3]>")
  .s("gm_accordion").velocity(.4)
  .room(.3).slow(2)`,
      },
      {
        label: 'Metallic Pad',
        code: `// metallic ringing pad
$: note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_metallic_pad").velocity(.3)
  .room(.6).roomsize(5).slow(4)`,
      },
      {
        label: 'Sweep Pad',
        code: `// sweeping filter pad
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_sweep_pad").velocity(.3)
  .room(.5).slow(2)`,
      },
      {
        label: 'Bowed Glass',
        code: `// bowed glass pad
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("gm_bowed_glass").velocity(.3)
  .room(.7).roomsize(5).slow(4)`,
      },
      {
        label: '12-Bar Blues',
        code: `// 12-bar blues chords
$: note("<[c3,e3,g3,b3] [c3,e3,g3,b3] [c3,e3,g3,b3] [c3,e3,g3,b3] [f3,a3,c4,e4] [f3,a3,c4,e4] [c3,e3,g3,b3] [c3,e3,g3,b3] [g3,b3,d4,f4] [f3,a3,c4,e4] [c3,e3,g3,b3] [g3,b3,d4,f4]>")
  .s("piano").gain(.45).room(.3).slow(6)`,
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
$: note("c3*4").s("sawtooth").gain(.4)
  .lpf(sine.range(200,4000).slow(4))
  .lpq(6)`,
      },
      {
        label: 'Dub Delay',
        code: `// dub echo effect
$: s("rim:3 ~ ~ rim:3")
  .gain(.5).delay(.5)
  .delayfeedback(.65).room(.4)`,
      },
      {
        label: 'Reverb Cathedral',
        code: `// massive reverb space
$: note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("piano").gain(.45)
  .room(.9).roomsize(8)`,
      },
      {
        label: 'Bit Crush',
        code: `// lo-fi bit crushing
$: note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4)
  .crush(6).lpf(2000)`,
      },
      {
        label: 'Chop Glitch',
        code: `// glitchy chop FX
$: note("c3").s("sawtooth")
  .chop(16).gain(.4)
  .speed("<1 2 .5 1.5>")`,
      },
      {
        label: 'Stutter',
        code: `// stutter repeat effect
$: note("c4").s("piano")
  .chop(8).gain(.5)
  .room(.3)`,
      },
      {
        label: 'Vowel Morph',
        code: `// morphing vowel filter
$: note("c3*4").s("sawtooth")
  .gain(.4)
  .vowel("<a e i o u>")`,
      },
      {
        label: 'Phaser Effect',
        code: `// phaser on chord
$: note("[c3,e3,g3]*2")
  .s("sawtooth").gain(.35)
  .phaser(4).phaserdepth(2)`,
      },
      {
        label: 'Pan Stereo',
        code: `// stereo auto-pan
$: note("c4 e4 g4 b4")
  .s("sine").gain(.45)
  .pan(sine.range(0,1))`,
      },
      {
        label: 'Speed Warp',
        code: `// speed modulation FX
$: s("bd sd hh cp")
  .bank("RolandTR808")
  .speed(perlin.range(.5,2))
  .gain(.6)`,
      },
      {
        label: 'Feedback Loop',
        code: `// heavy feedback delay
$: note("c4 ~ ~ ~").s("sine")
  .gain(.4).delay(.3)
  .delayfeedback(.85)
  .room(.3)`,
      },
      {
        label: 'Ring Mod',
        code: `// ring modulation tone
$: note("c3").s("sine").gain(.4)
  .ring(1).ringdf(500)`,
      },
      {
        label: 'Noise Wash',
        code: `// filtered noise sweep
$: s("hh*16").gain(.3)
  .lpf(sine.range(200,8000).slow(8))
  .room(.5)`,
      },
      {
        label: 'Retro Crush',
        code: `// retro crunch FX
$: note("c3 g3 e3 b3")
  .s("square").gain(.35)
  .crush(4).coarse(3)`,
      },
      {
        label: 'Delay Cascade',
        code: `// cascading delay echoes
$: note("c5 ~ ~ ~ e5 ~ ~ ~")
  .s("sine").gain(.4)
  .delay(.6).delayfeedback(.7)
  .delaytime(.33)`,
      },
      {
        label: 'Reverse Feel',
        code: `// reverse-like texture
$: s("chin:0").speed(-1)
  .gain(.5).room(.5)
  .delay(.3)`,
      },
      {
        label: 'Shimmer Verb',
        code: `// shimmering reverb
$: note("c5 e5 g5 c6").slow(2)
  .s("sine").gain(.35)
  .room(.9).roomsize(8)
  .delay(.3).delayfeedback(.4)`,
      },
      {
        label: 'Granular Chop',
        code: `// granular-style chop
$: s("bd").chop(32)
  .speed(perlin.range(.25,3))
  .gain(.5).room(.3)`,
      },
      {
        label: 'Dual Delay',
        code: `// ping-pong style delay
$: note("c4 ~ e4 ~").s("triangle")
  .gain(.4).delay(.5)
  .delayfeedback(.6)
  .pan("<0 1>")`,
      },
      {
        label: 'Distortion Wall',
        code: `// distorted wall of sound
$: note("[c2,g2,c3]").s("sawtooth")
  .gain(.35).shape(.6)
  .lpf(800).room(.3)`,
      },
      {
        label: 'Tape Stop',
        code: `// tape stop effect
$: note("c3 e3 g3 c4")
  .s("sawtooth").gain(.4)
  .speed(perlin.range(.2,1)).lpf(2000)`,
      },
      {
        label: 'Flanger Sweep',
        code: `// flanger on drums
$: s("bd sd:2 [~ bd] sd")
  .bank("RolandTR808").gain(.7)
  .phaser(sine.range(1,8).slow(4))`,
      },
      {
        label: 'Grain Cloud',
        code: `// granular cloud texture
$: s("chin:0").chop(64)
  .speed(perlin.range(.1,4))
  .gain(.4).room(.6)`,
      },
      {
        label: 'Pitch Dive',
        code: `// pitch diving effect
$: note("c5 c5 c5 c5")
  .s("sine").gain(.4)
  .speed("<1 .5 .25 .12>")`,
      },
      {
        label: 'Lo-Fi Wash',
        code: `// lo-fi degraded wash
$: note("[c3,g3]*2").s("sawtooth")
  .gain(.35).crush(6).coarse(4)
  .room(.6).lpf(1500)`,
      },
      {
        label: 'Stutter Gate',
        code: `// gate stutter effect
$: note("c3").s("supersaw")
  .gain("[.5 0 .5 0 .5 0 .5 0]*2")
  .lpf(2000)`,
      },
      {
        label: 'Auto Wah',
        code: `// auto wah envelope
$: note("c3*4").s("sawtooth")
  .gain(.4)
  .lpf(sine.range(300,3000).fast(2))
  .lpq(10)`,
      },
      {
        label: 'Sidechain Feel',
        code: `// sidechain pump feel
$: note("[c3,e3,g3]").s("supersaw")
  .gain("[.1 .3 .45 .5]*2")
  .lpf(1800).room(.3)`,
      },
      {
        label: 'Freeze Hold',
        code: `// freeze sustain
$: note("c4").s("sine")
  .gain(.4).room(.9).roomsize(10)
  .delay(.8).delayfeedback(.85)`,
      },
      {
        label: 'Chaos Noise',
        code: `// chaotic noise FX
$: s("hh*16").speed(perlin.range(.1,5))
  .gain(.3).crush(4)
  .pan(perlin.range(0,1))`,
      },
      {
        label: 'Tape Warble',
        code: `// warbling tape effect
$: note("c3 e3 g3 c4").s("piano")
  .gain(.4).speed(sine.range(.95,1.05).slow(2))
  .lpf(2500).room(.3)
  .delay(.2).delayfeedback(.3)`,
      },
      {
        label: 'Chorus Wash',
        code: `// chorus effect wash
$: note("[c3,e3,g3]").s("sawtooth")
  .gain(.3).detune(sine.range(0,30).slow(4))
  .lpf(1500).room(.5)`,
      },
      {
        label: 'Glitch Slice',
        code: `// glitch slice machine
$: s("bd sd hh cp rim oh bd sd")
  .bank("RolandTR808").gain(.6)
  .chop(8).speed(perlin.range(.25,3))
  .pan(perlin.range(0,1))`,
      },
      {
        label: 'Radio Static',
        code: `// radio static effect
$: s("hh*32").gain("[.05 .15]*16")
  .crush(3).coarse(5)
  .lpf(sine.range(500,4000).slow(8))
  .pan(perlin.range(.3,.7))`,
      },
      {
        label: 'Crystal Echo',
        code: `// crystal echo reflections
$: note("c5 e5 g5 b5 c6 b5 g5 e5")
  .s("sine").gain(.35)
  .fmi(2).fmh(5)
  .delay(.4).delayfeedback(.6)
  .room(.7).slow(2)`,
      },
      {
        label: 'Drone Morph',
        code: `// morphing drone texture
$: note("[c2,g2]").s("sawtooth")
  .gain(.25).lpf(sine.range(200,1500).slow(16))
  .vowel("<a e i o>")
  .room(.8).roomsize(6)`,
      },
      {
        label: 'Wind Chimes',
        code: `// wind chime effect
$: n(irand(12).segment(16))
  .scale("C5:major pentatonic")
  .s("gm_glockenspiel").velocity(.3)
  .room(.6).delay(.3).delayfeedback(.5)`,
      },
      {
        label: 'Underwater',
        code: `// underwater effect
$: note("c3 e3 g3 b3").s("sine")
  .gain(.35).lpf(sine.range(200,800).slow(4))
  .room(.8).roomsize(8)
  .delay(.5).delayfeedback(.6)`,
      },
      {
        label: 'Sample Hold',
        code: `// sample and hold random
$: note("c3*8").s("square")
  .gain(.35).lpf(perlin.range(200,4000))
  .lpq(8).decay(.1)`,
      },
      {
        label: 'Laser Beam',
        code: `// laser beam effect
$: note("c6 c5 c4 c3 c2 c3 c4 c5")
  .s("sine").gain(.4)
  .fmi(8).fmh(1)
  .decay(.1).room(.3)`,
      },
      {
        label: 'Granular Scatter',
        code: `// granular scatter texture
$: s("chin:0").chop(64)
  .speed(perlin.range(.1,5))
  .gain(.35).pan(perlin.range(0,1))
  .room(.5).delay(.3).delayfeedback(.4)`,
      },
      {
        label: 'Metallic Ring',
        code: `// metallic ring modulation
$: note("c3 e3 g3 c4").s("sine")
  .gain(.4).ring(1).ringdf(800)
  .room(.4).delay(.25)`,
      },
      {
        label: 'Bit Cascade',
        code: `// bit depth cascade
$: note("c3 e3 g3 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35)
  .crush("<12 8 6 4 3 4 6 8>")
  .lpf(2000)`,
      },
      {
        label: 'Wobble Gate',
        code: `// wobble gate effect
$: note("[c3,e3,g3]").s("supersaw")
  .gain(sine.range(0,.5).fast(8))
  .lpf(sine.range(400,3000).fast(4))
  .room(.3)`,
      },
      {
        label: 'Reverse Swell',
        code: `// reverse swell buildup
$: note("<[c3,e3,g3]>").s("supersaw")
  .gain(.35).attack(1.5).decay(.1)
  .lpf(sine.range(500,3000).slow(4))
  .room(.5)`,
      },
      {
        label: 'Pitch Rise',
        code: `// rising pitch effect
$: note("c2 c2 c2 c2 c3 c3 c3 c3 c4 c4 c4 c4 c5 c5 c5 c5")
  .s("sine").gain(.4)
  .lpf(sine.range(300,4000).slow(4))
  .room(.3).slow(4)`,
      },
      {
        label: 'Texture Cloud',
        code: `// ambient texture cloud
$: s("hh*16").gain("[.02 .06 .04 .08]*4")
  .lpf(sine.range(500,5000).slow(16))
  .room(.8).roomsize(8)
  .pan(sine.range(.2,.8).slow(6))`,
      },
      {
        label: 'Vocoder Feel',
        code: `// vocoder-like effect
$: note("c3*4").s("sawtooth")
  .gain(.35).vowel("<a e i o u e a o>")
  .lpf(3000).room(.3)
  .pan(sine.range(.3,.7))`,
      },
      {
        label: 'Multi FX Chain',
        code: `// stacked FX chain
$: note("c3 e3 g3 b3").s("sawtooth")
  .gain(.35).crush(8)
  .lpf(sine.range(500,3000).slow(4))
  .delay(.4).delayfeedback(.5)
  .room(.5).pan(sine.range(.2,.8))`,
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
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[~ hh]*4").bank("RolandTR909").gain(.5)
$: note("<c2 c2 a1 b1>")
  .s("sawtooth").gain(.5)
  .lpf(800).shape(.15)
$: note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.3).slow(2)`,
      },
      {
        label: 'Dark Techno',
        code: `// dark techno drive
$: s("bd*4").gain(.9)
$: s("~ cp ~ ~").gain(.5).room(.3)
$: s("[~ hh]*4").gain(.4)
$: s("~ ~ ~ oh").gain(.3)
$: note("c1*4").s("sawtooth")
  .gain(.45).lpf(400).shape(.3)`,
      },
      {
        label: 'Boom Bap Beat',
        code: `// classic boom bap
$: s("bd ~ [~ bd] ~").bank("RolandTR808").gain(.85)
$: s("~ sd ~ sd").bank("RolandTR808").gain(.7)
$: s("[hh hh] [hh oh] [hh hh] [hh ~]").bank("RolandTR808").gain(.4)
$: note("<c2 f2 g2 b1>")
  .s("sine").gain(.5).lpf(200)`,
      },
      {
        label: 'Garage Shuffle',
        code: `// 2-step UK garage
$: s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[hh hh hh ~]*2").bank("RolandTR909").gain(.45)
$: note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)`,
      },
      {
        label: 'Synthwave',
        code: `// synthwave nostalgia
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.55)
$: s("[~ hh]*4").gain(.4)
$: note("<c2 f2 g2 a2>")
  .s("sawtooth").gain(.45)
  .lpf(600).shape(.2)
$: note("<[c4,e4,g4] [f4,a4,c5] [g4,b4,d5] [a4,c5,e5]>")
  .s("supersaw").gain(.3)
  .lpf(2000).room(.3).slow(2)`,
      },
      {
        label: 'Trap',
        code: `// modern trap
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.9)
$: s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.7)
$: s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .5 .35 .7]")
$: note("<c1 ~ e1 ~>")
  .s("sine").gain(.6).decay(.8)
  .lpf(180).shape(.25)`,
      },
      {
        label: 'DnB',
        code: `// drum and bass
$: s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
$: s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
$: s("hh*8").gain("[.3 .5]*4")
$: note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.5)
  .lpf(800).shape(.2)`,
      },
      {
        label: 'Ambient Drift',
        code: `// ambient texture
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.8).roomsize(6)
  .lpf(1500).slow(4)
$: note("<c5 e5 g5 b5>")
  .s("sine").gain(.2)
  .delay(.5).delayfeedback(.6)
  .room(.7).slow(4)`,
      },
      {
        label: 'Trance Build',
        code: `// trance energy
$: s("bd*4").gain(.85)
$: s("~ cp ~ ~").gain(.55)
$: s("[~ hh]*4").gain(.45)
$: s("~ ~ ~ oh").gain(.35)
$: note("c3 c3 e3 g3")
  .s("supersaw").gain(.4)
  .lpf(sine.range(800,3000).slow(8))`,
      },
      {
        label: 'Phonk',
        code: `// dark phonk
$: s("bd ~ [bd bd] ~").gain(.85)
$: s("~ cp ~ cp").gain(.6).room(.2)
$: s("[~ hh]*4").gain(.45)
$: note("<c2 c2 b1 c2>")
  .s("sine").gain(.5)
  .lpf(200).shape(.3)`,
      },
      {
        label: 'Drill',
        code: `// drill pattern
$: s("bd ~ [~ bd] ~").gain(.85)
$: s("~ ~ ~ sd").gain(.7)
$: s("hh*8").gain("[.25 .5 .3 .6 .25 .55 .3 .65]")
$: note("<c2 e2 f2 e2>")
  .s("sine").gain(.5)
  .lpf(200).decay(.6)`,
      },
      {
        label: 'Future Bass',
        code: `// future bass vibes
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.8)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
$: s("[~ hh]*4").gain(.4)
$: note("<[c4,e4,g4,b4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("supersaw").gain(.35)
  .lpf(2500).room(.3).slow(2)`,
      },
      {
        label: 'Dubstep',
        code: `// dubstep half-time
$: s("bd ~ ~ ~ bd ~ ~ ~").gain(.9)
$: s("~ ~ ~ ~ ~ ~ cp ~").gain(.7)
$: s("[~ hh]*4").gain(.4)
$: note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .lpq(8).shape(.2)`,
      },
      {
        label: 'Afrobeats',
        code: `// afrobeats groove
$: s("bd(3,8)").bank("RolandTR808").gain(.8)
$: s("cp(2,8)").bank("RolandTR808").gain(.5)
$: s("rim(5,8)").bank("RolandTR808").gain(.4)
$: s("hh(7,16)").bank("RolandTR808").gain("[.3 .5]*8")
$: note("<c2 f2 g2 f2>")
  .s("sine").gain(.5).lpf(200)`,
      },
      {
        label: 'R&B Smooth',
        code: `// smooth R&B
$: s("[bd ~] [~ bd] [bd ~] [~ ~]").gain(.75)
$: s("~ rim ~ rim").gain(.3)
$: s("[~ hh]*4").gain(.35)
$: note("<[e3,g3,b3,d4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)
$: note("<e2 a2 b2 g2>")
  .s("sine").gain(.45).lpf(200)`,
      },
      {
        label: 'Lo-Fi Hip Hop',
        code: `// lo-fi hip hop beats
$: s("[bd:3 ~] [~ bd:3] ~ ~").gain(.4).lpf(800)
$: s("~ rim ~ rim").gain(.15).lpf(2000)
$: s("[~ hh:2]*4").gain("[.1 .2 .12 .25]").lpf(3500)
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("piano").gain(.5).room(.4).slow(2)
$: note("<c2 a1>")
  .s("sine").gain(.5).lpf(200).slow(2)`,
      },
      {
        label: 'Electro Funk',
        code: `// electro funk groove
$: s("bd*4").gain(.85)
$: s("~ cp ~ ~").gain(.6)
$: s("[hh hh oh ~]*2").gain(.45)
$: note("c2 ~ c2 g2 ~ g2 b2 ~")
  .s("square").gain(.45)
  .lpf(1200).decay(.12)`,
      },
      {
        label: 'IDM Glitch',
        code: `// IDM complexity
$: s("bd(3,8)").gain(.75)
$: s("sd(5,8,1)").gain(.55)
$: s("hh(11,16)").gain(.35)
$: note("c3 e3 g3 b3 d4 b3 g3 e3")
  .s("triangle").gain(.4)
  .chop(4).lpf(2000)`,
      },
      {
        label: 'Reggaeton',
        code: `// reggaeton dembow
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.85)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
$: s("[hh hh]*4").gain("[.3 .5]*4")
$: note("<c2 f2 b1 e2>")
  .s("sine").gain(.5).lpf(200)`,
      },
      {
        label: 'Minimal Techno',
        code: `// minimal techno loop
$: s("bd*4").gain(.8)
$: s("~ rim ~ ~").gain(.3)
$: s("hh*16").gain("[.15 .3]*8")
$: note("c2*4").s("sine")
  .gain(.4).lpf(200).shape(.15)`,
      },
      {
        label: 'Acid Techno',
        code: `// acid techno
$: s("bd*4").gain(.9)
$: s("~ cp ~ ~").gain(.55)
$: s("[~ hh]*4").gain(.4)
$: note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(400,3000)).lpq(12)`,
      },
      {
        label: 'Chill Trap',
        code: `// chill trap
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.85)
$: s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.6)
$: s("hh*8").bank("RolandTR808").gain("[.2 .4]*4")
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("piano").gain(.4).room(.4).slow(2)`,
      },
      {
        label: 'House Piano',
        code: `// piano house
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("[~ hh]*4").bank("RolandTR909").gain(.5)
$: note("[c3,e3,g3] ~ [a2,c3,e3] ~")
  .s("piano").gain(.5).room(.3)`,
      },
      {
        label: 'Jungle Break',
        code: `// jungle breakbeat
$: s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
$: s("[~ sd ~ ~] [~ ~ sd ~]").gain(.7)
$: s("hh*16").gain("[.2 .35]*8")
$: note("<c2 e2 f2 g2>")
  .s("sawtooth").gain(.5).lpf(600)`,
      },
      {
        label: 'Neo Soul',
        code: `// neo soul
$: s("[bd ~] [~ bd] [bd ~] ~").gain(.7)
$: s("~ rim ~ rim").gain(.3)
$: s("[~ hh]*4").gain(.35)
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("gm_epiano1").velocity(.35).room(.4).slow(2)`,
      },
      {
        label: 'UK Bass',
        code: `// UK bass music
$: s("bd ~ [~ bd] ~").gain(.85)
$: s("~ cp ~ ~").gain(.6)
$: s("[hh hh hh ~]*2").gain(.45)
$: note("[c2 ~] [~ e2] [c2 ~] [~ g1]")
  .s("sawtooth").gain(.55).lpf(800).shape(.2)`,
      },
      {
        label: 'Downtempo',
        code: `// downtempo chill
$: s("[bd:3 ~] ~ [~ bd:3] ~").gain(.4).lpf(800)
$: s("~ ~ rim ~").gain(.15)
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.3).room(.5).slow(4)`,
      },
      {
        label: 'Psytrance',
        code: `// psytrance drive
$: s("bd*4").gain(.9)
$: s("[~ hh]*4").gain(.4)
$: note("c2*8").s("sawtooth")
  .gain(.5).lpf(sine.range(300,2000).fast(4))
  .lpq(10)`,
      },
      {
        label: 'Footwork',
        code: `// footwork juke
$: s("bd bd [~ bd] bd bd [~ bd] bd [bd bd]").gain(.8)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.6)
$: s("hh*16").gain("[.2 .35]*8")`,
      },
      {
        label: 'Shoegaze',
        code: `// shoegaze wash
$: s("bd ~ bd ~").gain(.6)
$: s("~ sd ~ sd").gain(.45)
$: note("[c3,e3,g3,b3]").s("supersaw")
  .gain(.3).room(.9).roomsize(8)
  .delay(.4).delayfeedback(.6)`,
      },
      {
        label: 'Disco Funk',
        code: `// disco funk groove
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.6)
$: s("[hh hh oh ~]*2").bank("RolandTR909").gain(.45)
$: note("c2 c3 c2 c3 f2 f3 f2 f3")
  .s("gm_electric_bass_finger").velocity(.5)
$: note("<[c3,e3,g3] [f3,a3,c4] [g3,b3,d4] [c3,e3,g3]>")
  .s("gm_clean_guitar").velocity(.35)
  .room(.3).slow(2)`,
      },
      {
        label: 'Chillwave',
        code: `// chillwave dreamy
$: s("[bd ~] [~ bd] [bd ~] ~").gain(.6)
$: s("~ rim ~ rim").gain(.2)
$: s("[~ hh]*4").gain(.3)
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("supersaw").gain(.25)
  .lpf(1500).room(.6).delay(.3).delayfeedback(.4).slow(2)
$: note("<c2 a1>")
  .s("sine").gain(.4).lpf(200).slow(2)`,
      },
      {
        label: 'Drum & Bass Full',
        code: `// full drum and bass track
$: s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)
$: s("[~ ~ ~ ~] [~ sd ~ ~]").gain(.7)
$: s("hh*16").gain("[.2 .35]*8")
$: note("[c2 ~] [~ g2] [e2 ~] [~ c2]")
  .s("sawtooth").gain(.55)
  .lpf(800).shape(.2)
$: note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2)
  .lpf(1800).room(.3).slow(4)`,
      },
      {
        label: 'Latin Jazz',
        code: `// latin jazz groove
$: s("bd ~ [~ bd] ~ bd ~ [~ bd] ~").gain(.7)
$: s("rim ~ rim ~ rim ~ rim rim").gain(.3)
$: s("[hh hh]*4").gain("[.2 .3]*4")
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,d3,e3,g3]>")
  .s("gm_vibraphone").velocity(.35)
  .room(.4).slow(2)
$: note("c2 d2 e2 g2 a2 g2 e2 d2")
  .s("gm_acoustic_bass").velocity(.4)`,
      },
      {
        label: 'Reggae Dub',
        code: `// reggae dub track
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.75)
$: s("~ ~ cp ~ ~ ~ ~ ~").gain(.55)
  .delay(.4).delayfeedback(.55).room(.4)
$: s("[~ hh]*4").gain(.3)
$: note("c2 ~ ~ c2 ~ ~ e2 ~")
  .s("sine").gain(.55)
  .lpf(300).shape(.2).room(.3)
$: note("<[e3,g3,b3] ~ ~ [a3,c4,e4] ~ ~ ~ ~>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.3)`,
      },
      {
        label: 'Ambient Techno',
        code: `// ambient techno
$: s("bd*4").gain(.8)
$: s("~ rim ~ ~").gain(.25)
$: s("hh*16").gain("[.1 .2]*8")
$: note("c2*4").s("sine").gain(.4).lpf(200)
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.2)
  .room(.8).roomsize(6).slow(4)
$: note("<c5 e5 g5 b5>")
  .s("sine").gain(.15)
  .delay(.5).delayfeedback(.6).room(.6).slow(4)`,
      },
      {
        label: 'Garage Revival',
        code: `// UK garage revival
$: s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.55)
$: s("[hh hh hh ~]*2").bank("RolandTR909").gain(.4)
$: note("<[e3,g3,b3,d4] [a3,c4,e4,g4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)
$: note("<e2 a2>")
  .s("sine").gain(.45).lpf(200).slow(2)`,
      },
      {
        label: 'Grime Instrumental',
        code: `// grime instrumental
$: s("bd ~ [bd ~] ~ bd ~ [~ bd] ~")
  .bank("RolandTR808").gain(.85)
$: s("~ ~ ~ ~ ~ ~ cp ~")
  .bank("RolandTR808").gain(.7)
$: s("hh*8").bank("RolandTR808")
  .gain("[.3 .5 .35 .6 .3 .55 .35 .65]")
$: note("<c2 c2 b1 c2>")
  .s("square").gain(.5).lpf(400)
$: note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2).lpf(1200)`,
      },
      {
        label: 'Progressive House',
        code: `// progressive house
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.55)
$: s("[~ hh]*4").bank("RolandTR909").gain(.4)
$: s("~ ~ ~ oh").bank("RolandTR909").gain(.3)
$: note("<c2 c2 a1 b1>")
  .s("sawtooth").gain(.45)
  .lpf(sine.range(400,1500).slow(16))
$: note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("supersaw").gain(.25)
  .lpf(sine.range(800,2500).slow(8)).room(.3).slow(2)`,
      },
      {
        label: 'Funk Rock',
        code: `// funk rock groove
$: s("bd ~ [bd ~] ~ bd ~ ~ ~")
  .bank("RolandTR909").gain(.8)
$: s("~ sd ~ ~ ~ sd ~ [~ sd]")
  .bank("RolandTR909").gain(.65)
$: s("[hh hh oh ~]*2").bank("RolandTR909").gain(.4)
$: note("e2 ~ e2 g2 ~ g2 a2 b2")
  .s("gm_electric_bass_finger").velocity(.5)
$: note("e3 g3 a3 e3 g3 a3 b3 a3")
  .s("gm_overdriven_guitar").velocity(.4)`,
      },
      {
        label: 'Cinematic Score',
        code: `// cinematic film score
$: note("<[c3,e3,g3,c4] [a2,c3,e3,a3] [b2,d3,f3,b3] [g2,b2,d3,g3]>")
  .s("gm_strings1").velocity(.4)
  .room(.6).roomsize(5).slow(4)
$: note("<c5 e5 g5 b5>")
  .s("gm_flute").velocity(.3)
  .room(.5).slow(4)
$: s("~ ~ ~ ~ bd ~ ~ ~").gain(.5)
$: note("<c2 a1 b1 g1>")
  .s("gm_contrabass").velocity(.35).slow(4)`,
      },
      {
        label: 'Gospel',
        code: `// gospel praise groove
$: s("[bd ~] [~ bd] [bd ~] [~ ~]").gain(.75)
$: s("~ cp ~ cp").gain(.55)
$: s("[hh hh]*4").gain(.35)
$: note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,g3,a3,c4] [g3,b3,d4,f4]>")
  .s("piano").gain(.5).room(.4).slow(2)
$: note("<c2 f2 d2 g2>")
  .s("gm_acoustic_bass").velocity(.4).slow(2)
$: note("<[c4,e4,g4]>")
  .s("gm_choir_aahs").velocity(.25).room(.5).slow(4)`,
      },
      {
        label: 'Breakbeat Science',
        code: `// breakbeat science
$: s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
$: s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)
$: s("hh*16").gain("[.2 .35]*8")
$: note("c2 e2 g2 c3 g2 e2")
  .s("sawtooth").gain(.45).lpf(1000)
$: note("<[c3,e3,g3]>")
  .s("supersaw").gain(.2)
  .lpf(1500).room(.3).slow(4)
$: s("chin:0 ~ chin:1 ~").gain(.3)
  .room(.3).speed(1.2)`,
      },
      {
        label: 'Bollywood Fusion',
        code: `// bollywood fusion beat
$: s("bd ~ [~ bd] ~").gain(.8)
$: s("~ ~ cp ~").gain(.6)
$: s("[hh hh]*4").gain("[.25 .4]*4")
$: note("c4 d4 e4 f4 g4 a4 b4 c5")
  .s("gm_sitar").velocity(.4)
  .room(.3).slow(2)
$: note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("gm_strings1").velocity(.3)
  .room(.4).slow(2)`,
      },
      {
        label: 'Salsa',
        code: `// salsa groove
$: s("bd ~ ~ bd ~ bd ~ ~")
  .bank("RolandTR808").gain(.75)
$: s("rim ~ rim ~ ~ rim ~ ~")
  .bank("RolandTR808").gain(.35)
$: s("~ ~ ~ ~ cp ~ ~ ~")
  .bank("RolandTR808").gain(.5)
$: note("c2 ~ e2 c2 g2 ~ c2 ~")
  .s("gm_acoustic_bass").velocity(.5)
$: note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("piano").gain(.4).slow(2)`,
      },
      {
        label: 'Vaporwave',
        code: `// vaporwave aesthetic
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.6).lpf(600)
$: s("~ ~ cp ~ ~ ~ cp ~").gain(.4).room(.5)
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).delayfeedback(.4).slow(2)
$: note("<c2 a1 f1 g1>")
  .s("sine").gain(.35).lpf(200).slow(2)`,
      },
      {
        label: 'Hyperpop',
        code: `// hyperpop energy
$: s("bd ~ bd ~ bd ~ bd bd").gain(.85)
$: s("~ cp ~ cp").gain(.65).crush(10)
$: s("hh*16").gain("[.25 .4]*8").crush(8)
$: note("c3 e3 g3 c4 e4 c4 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(3000).crush(10)
$: note("c1*4").s("sine").gain(.5)
  .lpf(150).shape(.3)`,
      },
      {
        label: 'Bossa Nova Full',
        code: `// bossa nova full arrangement
$: s("bd ~ [~ bd] ~ bd ~ [~ bd] ~").gain(.6)
$: s("rim ~ rim ~ rim ~ rim rim").gain(.25)
$: s("[hh hh]*4").gain("[.12 .2]*4")
$: note("c2 d2 e2 g2 a2 g2 e2 d2")
  .s("gm_acoustic_bass").velocity(.4)
$: note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_nylon_guitar").velocity(.35)
  .room(.3).slow(2)`,
      },
      {
        label: 'Synthpop',
        code: `// synthpop track
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.55)
$: s("[~ hh]*4").gain(.4)
$: note("<c2 f2 g2 c2>")
  .s("square").gain(.45).lpf(600)
$: note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_saw_lead").velocity(.35).room(.3)
$: note("<[c3,e3,g3] [f3,a3,c4]>")
  .s("supersaw").gain(.25).lpf(1500).slow(2)`,
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
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("piano").gain(.5).room(.4).slow(2)
$: note("<c2 a1 b1 g1>")
  .s("sine").gain(.5).lpf(200).shape(.15).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.4).lpf(800).shape(.2)
$: s("~ rim ~ rim").gain(.15).lpf(2000)
$: s("[~ hh:2]*4").gain("[.1 .2 .12 .25]").lpf(3500)`,
      },
      {
        label: 'Rainy Rhodes',
        code: `// mellow rhodes in the rain
$: note("<[e3,g3,b3] [f3,a3,c4] [e3,g3,b3] [d3,f3,a3]>")
  .s("gm_epiano1").velocity(.3)
  .room(.5).delay(.3).slow(2)
$: note("<e2 f2 e2 d2>")
  .s("sine").gain(.45).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)
$: s("[~ hh:1]*4").gain("[.08 .15 .1 .2]").lpf(3000)`,
      },
      {
        label: 'Night Drive',
        code: `// dreamy late-night cruise
$: note("<[b3,d4,f4] [e3,g3,b3] [f3,a3,c4] [b3,d4,f4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)
$: note("<b1 e2 f2 b1>")
  .s("sine").gain(.45).lpf(200).shape(.15).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)
$: s("[~ hh:2]*4").gain("[.08 .18 .1 .2]").lpf(3000)`,
      },
      {
        label: 'Coffee Shop',
        code: `// cozy morning coffee
$: note("<[f3,a3,c4] [d3,f3,a3] [b2,d3,f3] [c3,e3,g3]>")
  .s("piano").gain(.5).room(.35).slow(2)
$: note("<f2 d2 b1 c2>")
  .s("sine").gain(.45).lpf(200).slow(2)
$: s("[bd:3 ~ ~] [~ ~ bd:3] ~ ~")
  .gain(.35).lpf(600)
$: s("[hh:1 ~ hh:1 ~]*2")
  .gain("[.08 .15 .1 .18]").lpf(3000)`,
      },
      {
        label: 'Sunset Gold',
        code: `// golden hour warmth
$: note("<[d3,f3,a3,c4] [e3,g3,b3] [d3,f3,a3] [a2,c3,e3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).delayfeedback(.35).slow(2)
$: note("<d2 e2 d2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] ~ ~ [~ bd:3]")
  .gain(.3).lpf(500)`,
      },
      {
        label: 'Autumn Leaves',
        code: `// falling leaves nostalgia
$: note("<[g3,b3,d4] [c3,e3,g3] [d3,f3,a3] [e3,g3,b3]>")
  .s("piano").gain(.5).room(.4)
  .delay(.25).delayfeedback(.3).slow(2)
$: note("<g1 c2 d2 e2>")
  .s("sine").gain(.45).lpf(200).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.35).lpf(600)`,
      },
      {
        label: 'Moonlight',
        code: `// ethereal moonlit walk
$: note("<[a3,c4,e4] [f3,a3,c4] [g3,b3,d4] [e3,g3,b3]>")
  .s("piano").gain(.3).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)
$: note("<a1 f1 g1 e1>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Tape Loop',
        code: `// vintage tape rhodes
$: note("<[e3,a3,b3] [a2,d3,e3] [g2,a2,d3] [b2,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).delay(.3).slow(2)
$: note("<e2 a1 g2 b1>")
  .s("sine").gain(.45).lpf(200).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.35).lpf(600)`,
      },
      {
        label: '3AM Thoughts',
        code: `// dark bedroom confessions
$: note("<[d3,e3,a3] [a2,d3,e3] [b2,e3,g3] [a2,b2,e3]>")
  .s("piano").gain(.45).room(.5)
  .delay(.35).delayfeedback(.4).slow(2)
$: note("<d2 a1 b1 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Morning Light',
        code: `// bright morning warmth
$: note("<[d3,g3,a3] [g2,b2,d3] [a2,d3,e3] [d3,g3,a3]>")
  .s("piano").gain(.55).room(.35).slow(2)
$: note("<d2 g1 a1 d2>")
  .s("sine").gain(.45).lpf(200).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.35).lpf(600)`,
      },
      {
        label: 'Vinyl Crackle',
        code: `// lo-fi vinyl warmth
$: note("<[e3,g3,b3] [a2,c3,e3]>")
  .s("piano").gain(.45).room(.4).slow(2)
$: note("<e2 a1>")
  .s("sine").gain(.45).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(600)
$: s("[~ hh:1]*4").gain("[.06 .12 .08 .15]").lpf(2500)`,
      },
      {
        label: 'Jazz Cafe',
        code: `// smoky jazz cafe
$: note("<[d3,f3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.3)
  .room(.4).slow(2)
$: note("<d2 g2 c2 f2>")
  .s("sine").gain(.4).lpf(200).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)`,
      },
      {
        label: 'Dreamy Piano',
        code: `// dreamy piano wash
$: note("<[f3,a3,c4,e4] [d3,f3,a3,c4]>")
  .s("piano").gain(.4).room(.6)
  .delay(.35).delayfeedback(.4).slow(4)
$: note("<f1 d1>")
  .s("sine").gain(.4).lpf(150).slow(4)`,
      },
      {
        label: 'Bedroom Pop',
        code: `// bedroom pop feel
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("piano").gain(.5).room(.35).slow(2)
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
$: s("~ rim ~ rim").gain(.12)
$: s("[~ hh:1]*4").gain("[.08 .15 .1 .2]").lpf(3000)`,
      },
      {
        label: 'Ambient Rain',
        code: `// ambient rain mood
$: note("<[c3,g3,c4]>")
  .s("sine").gain(.25)
  .room(.8).roomsize(6)
  .lpf(1200).slow(4)
$: s("hh*16").gain("[.04 .08]*8")
  .lpf(2000).room(.5)`,
      },
      {
        label: 'Warm Vibes',
        code: `// warm vibraphone lofi
$: n("<[~ 0] [4 ~] [~ 7] [4 ~]>")
  .scale("A3:minor pentatonic")
  .s("gm_vibraphone").velocity(.2)
  .room(.5).delay(.3).slow(2)
$: note("<c2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)`,
      },
      {
        label: 'Chill Pad',
        code: `// chillout pad texture
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.2)
  .lpf(1200).room(.6).slow(4)
$: note("<c2 a1>")
  .s("sine").gain(.4).lpf(160).slow(4)`,
      },
      {
        label: 'Old Cassette',
        code: `// old cassette tape feel
$: note("<[g3,b3,d4] [e3,g3,b3] [f3,a3,c4] [d3,f3,a3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
$: note("<g1 e2 f2 d2>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)
$: s("~ rim ~ ~").gain(.1).lpf(1500)`,
      },
      {
        label: 'Lazy Sunday',
        code: `// lazy sunday morning
$: note("<[b2,d3,f3,a3] [e3,g3,b3,d4] [f3,a3,c4,e4] [b2,d3,f3,a3]>")
  .s("piano").gain(.45).room(.4).slow(2)
$: note("<b1 e2 f2 b1>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.3).lpf(500)`,
      },
      {
        label: 'Sleepy Haze',
        code: `// sleepy haze
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.4).delayfeedback(.45).slow(4)
$: note("<a1 d2>")
  .s("sine").gain(.35).lpf(150).slow(4)`,
      },
      {
        label: 'Dusty Keys',
        code: `// dusty piano keys
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3]>")
  .s("piano").gain(.45).room(.4).slow(2)
$: note("<a1 d2 g1 c2>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Midnight Walk',
        code: `// midnight walk vibes
$: note("<[f3,a3,c4] [d3,f3,a3] [e3,g3,b3] [c3,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).slow(2)
$: note("<f1 d2 e2 c2>")
  .s("sine").gain(.4).lpf(170).slow(2)`,
      },
      {
        label: 'Cloud Nine',
        code: `// floating cloud vibes
$: note("<[g3,b3,d4,g4] [e3,g3,b3,d4]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.4).slow(4)`,
      },
      {
        label: 'Nostalgia',
        code: `// nostalgic warmth
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [f2,a2,c3,e3] [g2,b2,d3,f3]>")
  .s("piano").gain(.45).room(.4).slow(2)
$: note("<c2 a1 f1 g1>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Melted Ice',
        code: `// melted ice cream mood
$: note("<[b2,d3,f3,a3] [g2,b2,d3,f3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.3).slow(4)`,
      },
      {
        label: 'Warm Blanket',
        code: `// warm blanket feel
$: note("<[d3,f3,a3] [b2,d3,f3] [c3,e3,g3] [a2,c3,e3]>")
  .s("piano").gain(.5).room(.4).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~").gain(.3).lpf(600)
$: s("[~ hh:1]*4").gain("[.06 .12]*4").lpf(2500)`,
      },
      {
        label: 'Faded Photo',
        code: `// faded photograph
$: note("<[e3,g3,b3] [c3,e3,g3] [a2,c3,e3] [b2,d3,g3]>")
  .s("piano").gain(.4).room(.5)
  .delay(.3).delayfeedback(.35).slow(2)`,
      },
      {
        label: 'Window Rain',
        code: `// rain on window
$: note("<[a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.7).roomsize(5).slow(4)
$: s("hh*16").gain("[.03 .06]*8").lpf(2000).room(.4)`,
      },
      {
        label: 'Old Film',
        code: `// old film score feel
$: note("<[f3,a3,c4] [d3,f3,a3] [g3,b3,d4] [e3,g3,b3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
$: note("<f1 d1 g1 e1>")
  .s("sine").gain(.4).lpf(160).slow(2)`,
      },
      {
        label: 'Soft Landing',
        code: `// soft landing pad
$: note("<[c3,e3,g3,b3]>")
  .s("piano").gain(.3).room(.6)
  .delay(.4).delayfeedback(.5).slow(4)
$: note("c2").s("sine").gain(.35).lpf(140).slow(4)`,
      },
      {
        label: 'Sunset Groove',
        code: `// sunset groove session
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
$: s("~ rim ~ rim").gain(.12).lpf(1800)
$: s("[hh:2 ~ hh:2 ~]*2")
  .gain("[.06 .12 .08 .15]*2").lpf(3000)
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(.25)
  .room(.5).delay(.25).delayfeedback(.3).slow(2)
$: note("<a1 d2 e2 a1>")
  .s("sine").gain(.4).lpf(170).slow(2)`,
      },
      {
        label: 'Library Study',
        code: `// quiet library study
$: note("<[e3,g3,b3,d4] [a2,c3,e3,g3] [d3,g3,a3,c4] [g2,b2,d3,f3]>")
  .s("piano").gain(.4).room(.35).slow(2)
$: note("<e2 a1 d2 g1>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(600)
$: s("[~ hh:1]*4").gain("[.05 .1 .07 .12]").lpf(2500)`,
      },
      {
        label: 'Rooftop View',
        code: `// rooftop city view
$: note("<[f3,a3,c4,e4] [b2,d3,g3,a3] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.45).room(.4)
  .delay(.2).delayfeedback(.3).slow(2)
$: note("<f2 b1 e2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~")
  .gain(.3).lpf(550)`,
      },
      {
        label: 'Rainy Window',
        code: `// rainy window pane
$: note("<[d3,f3,a3,c4] [g2,b2,d3,f3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.6).delay(.3).delayfeedback(.35).slow(4)
$: note("<d2 g1>")
  .s("sine").gain(.35).lpf(160).slow(4)
$: s("hh*16").gain("[.02 .05]*8").lpf(1800).room(.4)`,
      },
      {
        label: 'Bookshop Calm',
        code: `// bookshop afternoon
$: note("<[g3,b3,d4,g4] [c3,e3,g3,b3] [d3,g3,a3,c4] [e3,g3,b3,d4]>")
  .s("piano").gain(.45).room(.35).slow(2)
$: note("<g1 c2 d2 e2>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~")
  .gain(.3).lpf(500)
$: s("~ ~ rim ~").gain(.08).lpf(1500)`,
      },
      {
        label: 'Garden Peace',
        code: `// peaceful garden walk
$: note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [d3,f3,a3,c4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.25).slow(2)
$: note("<c2 f2 d2 g2>")
  .s("sine").gain(.35).lpf(170).slow(2)`,
      },
      {
        label: 'Late Night Radio',
        code: `// late night radio vibes
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.3).lpf(650)
$: s("~ rim ~ rim").gain(.1).lpf(1500)
$: s("[~ hh:1]*4").gain("[.05 .1]*4").lpf(2500)
$: note("<[b2,d3,f3,a3] [e3,g3,b3,d4] [f3,a3,c4,e4] [b2,d3,f3,a3]>")
  .s("piano").gain(.4).room(.4).slow(2)
$: note("<b1 e2 f2 b1>")
  .s("sine").gain(.4).lpf(170).slow(2)`,
      },
      {
        label: 'Misty Morning',
        code: `// misty morning haze
$: note("<[e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.4).slow(4)
$: note("<e2 a1>")
  .s("sine").gain(.35).lpf(150).slow(4)
$: s("hh*16").gain("[.02 .04]*8").lpf(1500).room(.3)`,
      },
      {
        label: 'Warm Cocoa',
        code: `// warm cocoa evening
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [f2,a2,c3,e3] [e3,g3,b3,d4]>")
  .s("piano").gain(.45).room(.4).slow(2)
$: note("<a1 d2 f1 e2>")
  .s("sine").gain(.4).lpf(180).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~").gain(.3).lpf(550)
$: s("~ ~ rim ~").gain(.08).lpf(1200)`,
      },
      {
        label: 'Ocean Breeze',
        code: `// ocean breeze chill
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.3).delayfeedback(.35).slow(2)
$: note("<c2 a1 f1 g1>")
  .s("sine").gain(.35).lpf(160).slow(2)
$: s("hh*16").gain("[.03 .06]*8").lpf(2000).room(.3)`,
      },
      {
        label: 'Candlelight',
        code: `// candlelight dinner
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.4).room(.4)
  .delay(.2).delayfeedback(.3).slow(2)
$: note("<d2 g2 e2 a1>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Porch Swing',
        code: `// porch swing afternoon
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.3).lpf(600)
$: s("~ rim ~ rim").gain(.1).lpf(1500)
$: note("<[f3,a3,c4,e4] [b2,d3,f3,a3] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.5).delay(.25).slow(2)
$: note("<f1 b1 c2 f1>")
  .s("sine").gain(.35).lpf(160).slow(2)`,
      },
      {
        label: 'Twilight Zone',
        code: `// twilight zone vibes
$: note("<[g3,a3,d4,e4] [b2,d3,g3,a3]>")
  .s("piano").gain(.35).room(.5)
  .delay(.35).delayfeedback(.45).slow(4)
$: note("<g1 b1>")
  .s("sine").gain(.35).lpf(150).slow(4)`,
      },
      {
        label: 'Vintage Soul',
        code: `// vintage soul warmth
$: s("[bd:3 ~] [~ bd:3] [bd:3 ~] ~")
  .gain(.35).lpf(700)
$: s("~ rim ~ rim").gain(.12).lpf(1800)
$: note("<[e3,g3,b3,d4] [a3,c4,e4,g4] [b3,d4,f4,a4] [g3,b3,d4,f4]>")
  .s("gm_epiano1").velocity(.25)
  .room(.4).slow(2)
$: note("<e2 a2 b2 g2>")
  .s("sine").gain(.4).lpf(180).slow(2)`,
      },
      {
        label: 'Gentle River',
        code: `// gentle river flow
$: note("<[g3,b3,d4] [c3,e3,g3] [d3,g3,a3] [g3,b3,d4]>")
  .s("piano").gain(.4).room(.45)
  .delay(.3).delayfeedback(.35).slow(2)
$: note("<g1 c2 d2 g1>")
  .s("sine").gain(.35).lpf(170).slow(2)
$: s("hh*16").gain("[.02 .04]*8").lpf(1800)`,
      },
      {
        label: 'Train Ride',
        code: `// train ride scenery
$: s("[bd:3 ~] [bd:3 ~] [bd:3 ~] [bd:3 ~]")
  .gain(.25).lpf(500)
$: note("<[a2,c3,e3,g3] [d3,f3,a3,c4] [e3,g3,b3,d4] [a2,c3,e3,g3]>")
  .s("piano").gain(.4).room(.4).slow(2)
$: note("<a1 d2 e2 a1>")
  .s("sine").gain(.35).lpf(170).slow(2)`,
      },
      {
        label: 'Cozy Blanket',
        code: `// cozy blanket and tea
$: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [a2,c3,e3,g3] [d3,f3,a3,c4]>")
  .s("piano").gain(.4).room(.45).slow(2)
$: note("<d2 g1 a1 d2>")
  .s("sine").gain(.35).lpf(160).slow(2)
$: s("[bd:3 ~] ~ [~ bd:3] ~").gain(.25).lpf(500)`,
      },
      {
        label: 'Stargazing',
        code: `// stargazing at midnight
$: note("<[a3,c4,e4,g4] [d3,f3,a3,c4]>")
  .s("gm_epiano1").velocity(.2)
  .room(.6).roomsize(4)
  .delay(.35).delayfeedback(.4).slow(4)
$: note("<a1 d1>")
  .s("sine").gain(.3).lpf(140).slow(4)`,
      },
      {
        label: 'Paper Planes',
        code: `// paper planes floating
$: note("<[e3,g3,b3,d4] [c3,e3,g3,b3] [a2,c3,e3,g3] [b2,d3,g3,a3]>")
  .s("piano").gain(.4).room(.4)
  .delay(.25).delayfeedback(.3).slow(2)
$: note("<e2 c2 a1 b1>")
  .s("sine").gain(.35).lpf(170).slow(2)
$: s("[bd:3 ~] [~ bd:3] ~ ~").gain(.25).lpf(500)
$: s("[~ hh:1]*4").gain("[.04 .08]*4").lpf(2200)`,
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
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.6).room(.3)
  .scope()`,
      },
      {
        label: 'Pianoroll + Chords',
        code: `// chord progression pianoroll
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("piano").gain(.5).room(.4).slow(2)
  .pianoroll({cycles:4})`,
      },
      {
        label: 'Spiral + Arp',
        code: `// arpeggio with spiral visual
$: note("c3 e3 g3 b3 c4 b3 g3 e3")
  .s("supersaw").gain(.4)
  .lpf(2500).room(.3)
  .spiral()`,
      },
      {
        label: 'Pitchwheel + Melody',
        code: `// melody with pitch wheel visual
$: note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_vibraphone").velocity(.5)
  .room(.4)
  .pitchwheel()`,
      },
      {
        label: 'Punchcard + Drums',
        code: `// drum pattern punchcard visual
$: s("bd sd [~ bd] sd, [~ hh]*4, oh(2,8)")
  .bank("RolandTR808").gain(.75)
  .punchcard()`,
      },
      {
        label: 'Wordfall + Beats',
        code: `// beat pattern with wordfall labels
$: s("bd sd hh cp rim oh bd sd")
  .bank("RolandTR808").gain(.7)
  .wordfall()`,
      },
      {
        label: 'Scope Cyan Thick',
        code: `// thick cyan scope
$: note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4)
  .lpf(2000)
  .scope({color:"#22d3ee",thickness:3})`,
      },
      {
        label: 'Scope Pink',
        code: `// pink neon scope
$: note("c4 e4 g4 c5")
  .s("sine").gain(.5)
  .room(.3)
  .scope({color:"#ff1493",thickness:2})`,
      },
      {
        label: 'Scope Green Smear',
        code: `// smeared green scope trail
$: note("c3*4").s("sawtooth")
  .gain(.4).lpf(sine.range(200,4000).slow(4))
  .scope({color:"#4ade80",smear:.95,thickness:2})`,
      },
      {
        label: 'Fscope + Bass',
        code: `// bass frequency spectrum
$: note("c2 e2 g2 c3")
  .s("sawtooth").gain(.5)
  .lpf(1200).shape(.15)
  .fscope()`,
      },
      {
        label: 'Pianoroll Wide',
        code: `// wide pianoroll 8 cycles
$: n("0 2 4 7 9 12 9 7 4 2 0 -3")
  .scale("A2:minor pentatonic")
  .s("piano").gain(.5)
  .pianoroll({cycles:8})`,
      },
      {
        label: 'Multi Visual Scope',
        code: `// multi-track with scope
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.6)
$: note("c3 e3 g3 b3")
  .s("sawtooth").gain(.4).lpf(1500)
  .scope({color:"#a855f7",thickness:2})`,
      },
      {
        label: 'Spiral + Pad',
        code: `// pad with spiral visual
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.4).slow(2)
  .spiral()`,
      },
      {
        label: 'Pitchwheel + Flute',
        code: `// flute melody with pitchwheel
$: note("d5 f5 a5 g5 f5 d5 c5 d5")
  .s("gm_flute").velocity(.5).room(.4)
  .pitchwheel()`,
      },
      {
        label: 'Scope Orange',
        code: `// orange warm scope
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_epiano1").velocity(.4).room(.3)
  .scope({color:"#f97316",thickness:2,smear:.8})`,
      },
      {
        label: 'Punchcard + Full',
        code: `// full beat with punchcard
$: s("bd*4, ~ cp ~ ~, [~ hh]*4, oh(2,8)")
  .bank("RolandTR909").gain(.7)
$: note("c2*4").s("sine").gain(.4).lpf(200)
  .punchcard()`,
      },
      {
        label: 'Pianoroll + Scale',
        code: `// scale run pianoroll
$: n("0 1 2 3 4 5 6 7 6 5 4 3 2 1 0 -1")
  .scale("D4:dorian")
  .s("gm_marimba").velocity(.5).room(.3)
  .pianoroll({cycles:4})`,
      },
      {
        label: 'Scope Gold Smear',
        code: `// gold smeared scope
$: note("c3 g3 e4 c4 g3 e3 c3 g2")
  .s("sawtooth").gain(.35).lpf(1500)
  .scope({color:"#eab308",thickness:2,smear:.9})`,
      },
      {
        label: 'Wordfall + Samples',
        code: `// sample names falling
$: s("bd cp hh oh rim sd bd cp")
  .bank("RolandTR808").gain(.65)
  .wordfall()`,
      },
      {
        label: 'Scope Red',
        code: `// red hot scope
$: note("c2*4").s("sawtooth")
  .gain(.5).lpf(sine.range(100,2000).fast(4))
  .shape(.2)
  .scope({color:"#ef4444",thickness:3})`,
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
$: s("chin*4").gain(.6)
  .speed("<1 1.5 .75 2>")
  .room(.4).delay(.25)`,
      },
      {
        label: 'Breath Pad',
        code: `// breathy vocal texture
$: s("breath:0 breath:1 breath:0 breath:2")
  .gain(.4).room(.7).roomsize(5)
  .lpf(2000).slow(2)`,
      },
      {
        label: 'Vocal Stack',
        code: `// layered vocal hits
$: s("chin:0 chin:1 chin:2 chin:3")
  .gain(.5).room(.4)
  .speed(1).pan(sine.range(0,1))`,
      },
      {
        label: 'Stutter Vox',
        code: `// stuttered vocal
$: s("chin").chop(8)
  .speed(perlin.range(.8,1.5))
  .gain(.5).room(.3)`,
      },
      {
        label: 'Glitch Voice',
        code: `// glitched vocal FX
$: s("chin:1").chop(16)
  .speed("<1 -1 2 .5>")
  .gain(.5).crush(12)
  .room(.4).delay(.3)`,
      },
      {
        label: 'Choir Aahs',
        code: `// soft choir aahs
$: note("<[c3,e3,g3] [a2,c3,e3] [b2,d3,f3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.5).slow(2)`,
      },
      {
        label: 'Voice Oohs',
        code: `// voice oohs pad
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.5).slow(4)`,
      },
      {
        label: 'Synth Voice',
        code: `// synthetic voice lead
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_synth_voice").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Male Hum Low',
        code: `// low male humming tone
$: note("<c2 e2 f2 g2>")
  .s("gm_choir_aahs").velocity(.35)
  .lpf(600).room(.5).slow(2)`,
      },
      {
        label: 'Female Hum High',
        code: `// high female humming
$: note("<c4 e4 f4 g4>")
  .s("gm_voice_oohs").velocity(.35)
  .lpf(3000).room(.5).slow(2)`,
      },
      {
        label: 'Vocal Delay Echo',
        code: `// echoed vocal
$: s("chin:2").slow(2)
  .gain(.5).delay(.5)
  .delayfeedback(.6).room(.5)`,
      },
      {
        label: 'Reverb Cathedral',
        code: `// cathedral reverb vocal
$: s("chin:0 ~ chin:1 ~")
  .gain(.5).room(.9).roomsize(8)
  .slow(2)`,
      },
      {
        label: 'Delayed Choir',
        code: `// delayed choir wash
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.4).delayfeedback(.5)
  .room(.6).slow(4)`,
      },
      {
        label: 'Singing Melody',
        code: `// singing melodic line
$: note("c4 d4 e4 g4 f4 e4 d4 c4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4)`,
      },
      {
        label: 'Harmony Stack',
        code: `// stacked vocal harmony
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4).slow(2)
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.5).slow(2)`,
      },
      {
        label: 'Numbers Talking',
        code: `// counting beat vocal
$: s("numbers:0 numbers:1 numbers:2 numbers:3")
  .speed(1.2).gain(.5)
$: s("bd sd:2 bd sd:3")
  .bank("RolandTR808").gain(.7)`,
      },
      {
        label: 'East Chant',
        code: `// eastern chant
$: s("east:0 east:2 east:3 east:6")
  .gain(.5).room(.3).slow(2)
$: s("east:4 east:5").gain(.35)`,
      },
      {
        label: 'Chopped Choir',
        code: `// chopped choir stutter
$: note("[c3,e3,g3]")
  .s("gm_choir_aahs").velocity(.4)
  .chop(8).room(.3)`,
      },
      {
        label: 'Vocal Crush',
        code: `// crushed bitrate vocal
$: s("chin:0 chin:2 chin:1 chin:3")
  .gain(.5).crush(8)
  .room(.3)`,
      },
      {
        label: 'Reversed Vocal',
        code: `// reverse vocal texture
$: s("chin:0 chin:1")
  .speed(-1).gain(.5)
  .room(.5).delay(.3).slow(2)`,
      },
      {
        label: 'Female Singing',
        code: `// female singing line
$: note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4).delay(.15)`,
      },
      {
        label: 'Male Low Choir',
        code: `// deep male choir
$: note("<[c2,g2,c3] [a1,e2,a2]>")
  .s("gm_choir_aahs").velocity(.4)
  .lpf(800).room(.6).slow(4)`,
      },
      {
        label: 'Vocal Shimmer',
        code: `// shimmering vocal pad
$: note("<[c4,e4,g4,b4]>")
  .s("gm_voice_oohs").velocity(.3)
  .delay(.4).delayfeedback(.55)
  .room(.7).slow(4)`,
      },
      {
        label: 'Whisper Texture',
        code: `// whisper-like texture
$: s("breath:0 ~ breath:1 ~")
  .gain(.35).room(.7).roomsize(5)
  .lpf(3000).slow(2)`,
      },
      {
        label: 'Vocal Drone',
        code: `// droning vocal pad
$: note("[c3,g3]")
  .s("gm_choir_aahs").velocity(.3)
  .room(.8).roomsize(6)
  .lpf(1000)`,
      },
      {
        label: 'Humming Duet',
        code: `// male and female hum duet
$: note("<c3 d3 e3 d3>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(700).room(.5).slow(2)
$: note("<g4 a4 b4 a4>")
  .s("gm_voice_oohs").velocity(.25)
  .lpf(2500).room(.5).slow(2)`,
      },
      {
        label: 'Delayed Oohs',
        code: `// delayed oohs wash
$: note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.5).delayfeedback(.6)
  .room(.5)`,
      },
      {
        label: 'Vocal Over Beat',
        code: `// vocal chop over beats
$: s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
$: s("[~ hh]*4").bank("RolandTR808").gain(.3)
$: s("chin:0 ~ chin:1 ~").gain(.5)
  .speed(1.2).room(.3)
  .delay(.25).delayfeedback(.4)`,
      },
      {
        label: 'Choir Swell',
        code: `// swelling choir
$: note("<[c3,e3,g3,b3]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.15,.5).slow(4))
  .room(.6).slow(4)`,
      },
      {
        label: 'Pitch Shift Vox',
        code: `// pitch-shifted vocal
$: s("chin:0 chin:1 chin:2 chin:0")
  .speed("<.5 1 1.5 2>")
  .gain(.5).room(.4)
  .delay(.2)`,
      },
      {
        label: 'R&B Soul Vocal',
        code: `// R&B soul vocal — "Midnight Glow"
// I feel the glow beneath the moonlit sky
// Your love surrounds me and I don't know why
// Every whisper pulls me closer still
// Dancing slowly on the windowsill
// Hold me tight until the morning light
$: note("c4 d4 e4 g4 f4 e4 d4 c4").s("gm_voice_oohs")
  .velocity(sine.range(.3,.7).slow(8)).room(.5).delay(.15)
$: note("c3 e3 g3 b3").s("gm_epiano2").velocity(.3).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Jazz Scat Vocal',
        code: `// jazz scat vocal — "Blue Corner"
// Shoo-bee-doo-bah in the smoky hall
// Fingers snappin' echoes off the wall
// Walkin' bass line groovin' down below
// Trumpet cryin' soft and sweet and slow
// Midnight jazz that only dreamers know
$: note("g4 a4 b4 d5 c5 a4 g4 f4").s("gm_choir_aahs")
  .velocity("<.5 .6 .7 .5>").delay(.2).room(.6)
$: note("g2 a2 b2 c3 d3 c3 b2 a2").s("gm_acoustic_bass").velocity(.5)
$: s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Gospel Choir',
        code: `// gospel choir — "Rise Up"
// Rise up children lift your voice on high
// Through the storm we'll reach the open sky
// Every burden laid upon the ground
// Grace and mercy all around resound
// Sing it louder let the joy be found
$: note("[c4,e4,g4] [d4,f4,a4] [e4,g4,b4] [c4,e4,g4]")
  .s("gm_choir_aahs").velocity(.7).room(.7).slow(2)
$: note("[c3,g3] [d3,a3] [e3,b3] [c3,g3]")
  .s("gm_church_organ").velocity(.4).slow(2)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Hip-Hop Hook',
        code: `// hip-hop hook vocal — "City Lights"
// City lights reflectin' off the rain
// Chasin' dreams and runnin' through the pain
// Every block I walk I feel the beat
// Concrete jungle underneath my feet
// Mic in hand I own this midnight street
$: note("c4 c4 e4 f4 e4 c4 ~ c4").s("gm_synth_voice")
  .velocity(.6).delay(.1).room(.3)
$: note("c2 ~ c2 ~ e2 ~ f2 ~").s("gm_synth_bass_1").velocity(.7)
$: s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.6)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Country Ballad Vox',
        code: `// country ballad vocal — "Dusty Road"
// Down the dusty road where the willows sway
// I recall your smile at the end of day
// Porch light glowin' like a guiding star
// Strummin' six string underneath the bar
// Miles between us but you're never far
$: note("e4 g4 g4 a4 g4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(sine.range(.3,.6).slow(8)).room(.5)
$: note("e3 a3 b3 e3 a3 b3 e3 a3").s("gm_steel_guitar").velocity(.35)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Reggae Chant',
        code: `// reggae vocal chant — "One Love Flow"
// One love flowin' through the island breeze
// Roots and culture swaying through the trees
// Every riddim makes the people free
// From the mountain down into the sea
// Unity is all we need to be
$: note("g3 b3 c4 d4 c4 b3 g3 ~").s("gm_choir_aahs")
  .velocity(.5).room(.6).delay(.25)
$: note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.6)
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
$: s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Blues Moan Vocal',
        code: `// blues moan vocal — "Lonesome Trail"
// Walkin' down this lonesome trail alone
// Every step reminds me you are gone
// Guitar cryin' what my lips can't say
// Storm clouds rollin' in to steal the day
// Got the blues and they are here to stay
$: note("e3 g3 a3 b3 a3 g3 e3 ~").s("gm_voice_oohs")
  .velocity(sine.range(.4,.7).slow(6)).room(.5).slow(2)
$: note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Pop Vocal Hook',
        code: `// pop vocal hook — "Neon Hearts"
// Neon hearts are flashing in the dark
// Every beat ignites another spark
// Dancing under ultraviolet glow
// Spinning round and never letting go
// Turn the music up and steal the show
$: note("c5 b4 a4 g4 a4 b4 c5 ~").s("gm_voice_oohs")
  .velocity(.6).room(.4).delay(.12)
$: note("[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]")
  .s("gm_bright_piano").velocity(.35).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.25)`,
      },
      {
        label: 'Afrobeat Vocal',
        code: `// afrobeat vocal — "Sun Dancer"
// Sun dancer movin' to the ancient drum
// Feel the rhythm till the morning come
// Dust is risin' from the beaten ground
// Fire burnin' with a sacred sound
// Every step a blessing to be found
$: note("d4 f4 g4 a4 g4 f4 d4 f4").s("gm_choir_aahs")
  .velocity(.55).room(.4).delay(.18)
$: note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_synth_bass_1").velocity(.6)
$: s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Latin Vocal Salsa',
        code: `// latin vocal — "Fuego Nights"
// Fuego burning in the summer night
// Hips are swaying left and then the right
// Conga drums are calling from the street
// Every rhythm makes this life complete
// Dance until the sun and moonlight meet
$: note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_voice_oohs")
  .velocity(.5).room(.35).delay(.1)
$: note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.55)
$: s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Folk Harmony Vox',
        code: `// folk harmony vocal — "River Song"
// By the river where the cattails grow
// Sing a melody the waters know
// Harmonies as old as ancient stone
// Voices carry seeds the wind has sown
// Every verse a path that leads us home
$: note("g4 a4 b4 d5 b4 a4 g4 ~").s("gm_choir_aahs")
  .velocity(.45).room(.5)
$: note("d4 e4 g4 a4 g4 e4 d4 ~").s("gm_voice_oohs")
  .velocity(.35).room(.5)
$: note("g3 d3 g3 d3 g3 d3 g3 d3").s("gm_nylon_guitar").velocity(.3)`,
      },
      {
        label: 'Electronic Vox Pad',
        code: `// electronic vocal pad — "Digital Dreams"
// Floating through a digital terrain
// Synthesized emotions fill my brain
// Pixel stars are scattered all around
// Binary code becomes a human sound
// Lost between the silence and the rain
$: note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [g3,b3,d4]>")
  .s("gm_synth_choir").velocity(.5).room(.6).slow(4)
$: note("c5 e5 g5 ~ e5 c5 ~ g4").s("gm_synth_voice")
  .velocity(.3).delay(.3)
$: s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.35)`,
      },
      {
        label: 'Indie Vocal Layer',
        code: `// indie vocal layers — "Paper Moon"
// Cut a paper moon and hang it high
// Watch it drift across a painted sky
// Whispered secrets only stars can hear
// Melodies that make the clouds appear
// Sing until the dawn is finally near
$: note("e4 g4 a4 b4 a4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.5).room(.45).delay(.15)
$: note("e4 ~ a4 ~ b4 ~ g4 ~").s("gm_choir_aahs")
  .velocity(.3).room(.45).delay(.2)
$: note("e2 b2 e2 a2 g2 e2 b2 e2").s("gm_clean_guitar").velocity(.35)
$: s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Techno Vocal Chop',
        code: `// techno vocal chop — "System Override"
// System override breaking through the wall
// Bass is dropping deeper hear it call
// Strobe lights flashing in a concrete hall
// Every frequency controls us all
// Rise and fall and rise and never stall
$: s("chin:0 ~ chin:2 ~").speed("<1 1.5 .75 2>")
  .gain(.5).room(.2).delay(.1)
$: s("bd bd bd bd").bank("RolandTR909").gain(.65)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.4)
$: note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth").lpf(200).gain(.5)`,
      },
      {
        label: 'Lullaby Vocal',
        code: `// lullaby vocal — "Starlit Cradle"
// Close your eyes the stars are shining bright
// Dream of meadows bathed in silver light
// Gentle winds will carry you to sleep
// Counting fireflies and woolen sheep
// Safe and warm the night will softly keep
$: note("c5 b4 a4 g4 a4 g4 f4 e4").s("gm_voice_oohs")
  .velocity(sine.range(.2,.45).slow(8)).room(.6).slow(2)
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_music_box").velocity(.25).slow(4)`,
      },
      {
        label: 'Funk Vocal Groove',
        code: `// funk vocal groove — "Get Down"
// Get down get down and feel the funky beat
// Slap that bass and move your dancing feet
// Horns are blaring hot across the stage
// Every note is turnin up the page
// Groove so deep it echoes through the age
$: note("c4 ~ e4 f4 ~ e4 c4 ~").s("gm_synth_voice")
  .velocity(.6).room(.3)
$: note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.65)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.55)
$: note("~ [e5,g5] ~ ~ ~ [f5,a5] ~ ~").s("gm_brass1").velocity(.4)`,
      },
      {
        label: 'Choir Hymn Full',
        code: `// choir hymn — "Eternal Light"
// Eternal light that guides us through the night
// Voices joined in harmony and might
// Every soul uplifted by the song
// Together we are where we all belong
// Carry us oh music all day long
$: note("[c4,e4,g4,c5] ~ [d4,f4,a4,d5] ~ [e4,g4,b4,e5] ~ [c4,e4,g4,c5] ~")
  .s("gm_choir_aahs").velocity(.65).room(.7).slow(4)
$: note("[c3,g3] ~ [d3,a3] ~ [e3,b3] ~ [c3,g3] ~")
  .s("gm_church_organ").velocity(.4).slow(4)
$: s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Rock Anthem Vox',
        code: `// rock anthem vocal — "Thunder Road"
// Thunder road beneath the open sky
// Engines roar and eagles learn to fly
// Every mile a story left behind
// Searchin' for the freedom we will find
// Rock and roll forever on my mind
$: note("e4 e4 g4 a4 b4 a4 g4 e4").s("gm_choir_aahs")
  .velocity(.65).room(.4)
$: note("[e3,b3,e4] ~ [a3,e4,a4] ~ [d3,a3,d4] ~ [e3,b3,e4] ~")
  .s("gm_overdriven_guitar").velocity(.5).slow(2)
$: note("e2 ~ e2 ~ a2 ~ b2 ~").s("gm_electric_bass_pick").velocity(.55)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.55)`,
      },
      {
        label: 'Ambient Vocal Wash',
        code: `// ambient vocal wash — "Ocean Hymn"
// Waves are singing to the endless shore
// Echoes drifting through an open door
// Salt and mist upon the evening breeze
// Voices carried over emerald seas
// Peace within the silence if you please
$: note("<c4 d4 e4 f4 e4 d4 c4 b3>")
  .s("gm_voice_oohs").velocity(sine.range(.15,.4).slow(16))
  .room(.8).delay(.35).slow(4)
$: note("<[c3,e3,g3] [b2,d3,f3] [a2,c3,e3] [g2,b2,d3]>")
  .s("gm_warm_pad").velocity(.2).slow(8)`,
      },
      {
        label: 'Dancehall Vocal',
        code: `// dancehall vocal — "Bun It Up"
// Bun it up and let the speaker blow
// Riddim hot from head down to the toe
// Selecta play the tune we wanna know
// Crowd a jump and rock it high and low
// Dancehall vibes wherever that we go
$: note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_synth_voice")
  .velocity(.55).room(.3).delay(.15)
$: note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.6)
$: s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.55)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.35)`,
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
$: note("c4 e4 g4 c5 g4 e4 c4 e4")
  .s("gm_nylon_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Steel Arp',
        code: `// steel string arpeggio
$: note("e3 g3 b3 e4 b3 g3 e3 b2")
  .s("gm_steel_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Clean Electric',
        code: `// clean electric guitar
$: note("a3 c4 e4 a4 e4 c4 a3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Overdriven Riff',
        code: `// overdriven guitar riff
$: note("e2 e2 g2 a2 e2 e2 b2 a2")
  .s("gm_overdriven_guitar").velocity(.55)
  .gain(.5)`,
      },
      {
        label: 'Distortion Power',
        code: `// distorted power chords
$: note("<[e2,b2,e3] [c2,g2,c3] [d2,a2,d3] [a1,e2,a2]>")
  .s("gm_distortion_guitar").velocity(.5)
  .slow(2)`,
      },
      {
        label: 'Jazz Clean',
        code: `// jazz guitar clean
$: note("c3 e3 g3 b3 a3 f3 d3 g3")
  .s("gm_clean_guitar").velocity(.4)
  .room(.4).delay(.15)`,
      },
      {
        label: 'Muted Funk',
        code: `// muted funk guitar
$: note("c3 ~ c3 ~ c3 ~ c3 c3")
  .s("gm_muted_guitar").velocity(.5)
  .decay(.08)`,
      },
      {
        label: 'Harmonics',
        code: `// guitar harmonics
$: note("e5 b5 e6 b5 g5 e5 b4 e5")
  .s("gm_guitar_harmonics").velocity(.4)
  .room(.5).delay(.2)`,
      },
      {
        label: 'Nylon Chords',
        code: `// nylon chord strum
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3).slow(2)`,
      },
      {
        label: 'Blues Lick',
        code: `// blues guitar lick
$: note("c4 e4 f4 g4 g4 b4 g4 e4")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Country Pick',
        code: `// country picking
$: note("c3 e3 g3 c4 e3 g3 c4 e4")
  .s("gm_steel_guitar").velocity(.5)`,
      },
      {
        label: 'Tremolo Pick',
        code: `// tremolo picking
$: note("[e3 e3 e3 e3]*4")
  .s("gm_clean_guitar")
  .velocity("[.3 .5 .35 .55]*4")`,
      },
      {
        label: 'Slide Guitar',
        code: `// slide guitar feel
$: note("c3 d3 e3 g3 c4 g3 e3 d3")
  .s("gm_steel_guitar").velocity(.5)
  .glide(.15).room(.3)`,
      },
      {
        label: 'Fingerstyle',
        code: `// fingerstyle pattern
$: note("c3 g3 e4 g3 c3 g3 e4 c4")
  .s("gm_nylon_guitar").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Surf Rock',
        code: `// surf rock twang
$: note("e3 g3 a3 b3 e4 b3 a3 g3")
  .s("gm_clean_guitar").velocity(.5)
  .delay(.3).delayfeedback(.4)`,
      },
      {
        label: 'Power Slide',
        code: `// power chord slide
$: note("<[e2,b2,e3] [g2,d3,g3] [a2,e3,a3] [g2,d3,g3]>")
  .s("gm_overdriven_guitar").velocity(.5)
  .slow(2)`,
      },
      {
        label: 'Wah Guitar',
        code: `// wah-wah guitar
$: note("e3 g3 a3 e3 g3 a3 b3 a3")
  .s("gm_clean_guitar").velocity(.5)
  .lpf(sine.range(500,4000)).lpq(6)`,
      },
      {
        label: 'Pedal Steel',
        code: `// pedal steel vibe
$: note("e3 a3 b3 e4 a4 e4 b3 a3")
  .s("gm_steel_guitar").velocity(.4)
  .room(.5).delay(.25).slow(2)`,
      },
      {
        label: 'Flamenco Pick',
        code: `// flamenco rapid pick
$: note("[e4 f4 e4 d4]*2")
  .s("gm_nylon_guitar").velocity(.5)
  .decay(.1)`,
      },
      {
        label: 'Guitar + Drums',
        code: `// guitar with drums
$: s("bd ~ bd ~, ~ sd ~ sd").gain(.7)
$: s("[~ hh]*4").gain(.35)
$: note("c3 e3 g3 c4 g3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Acoustic Ballad',
        code: `// acoustic ballad
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.4).slow(4)`,
      },
      {
        label: 'Rock Riff',
        code: `// rock guitar riff
$: note("e2 ~ e3 e2 g2 ~ a2 b2")
  .s("gm_overdriven_guitar").velocity(.55)`,
      },
      {
        label: 'Octave Lead',
        code: `// octave guitar lead
$: note("c4 c5 e4 e5 g4 g5 b4 b5")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Reverb Nylon',
        code: `// reverb-drenched nylon
$: note("e4 b4 g4 e4")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.8).roomsize(6).slow(2)`,
      },
      {
        label: 'Distort Chug',
        code: `// chugging distortion
$: note("[e2 e2 ~ e2]*2")
  .s("gm_distortion_guitar").velocity(.55)
  .decay(.08)`,
      },
      {
        label: 'Clean Chorus',
        code: `// chorus clean tone
$: note("c4 e4 g4 b4")
  .s("gm_clean_guitar").velocity(.45)
  .room(.5).delay(.2).delayfeedback(.35).slow(2)`,
      },
      {
        label: 'Ambient Guitar',
        code: `// ambient guitar pad
$: note("<[c3,g3] [a2,e3]>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.8).roomsize(5)
  .delay(.4).delayfeedback(.5).slow(4)`,
      },
      {
        label: 'Palm Mute',
        code: `// palm mute chug
$: note("e2*8")
  .s("gm_muted_guitar")
  .velocity("[.3 .5 .35 .55 .3 .5 .35 .6]")`,
      },
      {
        label: 'Staccato Strum',
        code: `// staccato chord strum
$: note("[c3,e3,g3] ~ ~ [a2,c3,e3] ~ ~")
  .s("gm_steel_guitar").velocity(.5)
  .decay(.1)`,
      },
      {
        label: 'Guitar Delay Wash',
        code: `// guitar into delay wash
$: note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("gm_clean_guitar").velocity(.4)
  .delay(.5).delayfeedback(.7)
  .room(.5)`,
      },
      {
        label: 'Fingerstyle Ballad',
        code: `// fingerstyle ballad
$: note("e3 b3 g3 d4 b3 g3 e3 b2")
  .s("gm_nylon_guitar").velocity(sine.range(.3,.55).slow(8))
  .room(.45).delay(.1)
$: note("<[e3,b3,e4] [a2,e3,a3] [d3,a3,d4] [b2,g3,b3]>")
  .s("gm_nylon_guitar").velocity(.25).slow(4)`,
      },
      {
        label: 'Flamenco Rasgueado',
        code: `// flamenco rasgueado strum
$: note("[e3,a3,d4,g4,b4,e5] ~ ~ [e3,a3,d4,g4,b4,e5]")
  .s("gm_nylon_guitar").velocity("<.7 .5 .6 .7>")
  .room(.3)
$: note("~ [a3,d4,g4] [a3,d4,g4] ~")
  .s("gm_nylon_guitar").velocity(.4)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Texas Blues Lick',
        code: `// texas blues guitar lick
$: note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_overdriven_guitar").velocity(.55).room(.35)
$: note("[e3,b3] ~ [a3,e4] ~ [d3,a3] ~ [e3,b3] ~")
  .s("gm_clean_guitar").velocity(.3).slow(2)
$: note("e2 ~ e2 ~ a2 ~ b2 ~").s("gm_electric_bass_finger").velocity(.5)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Surf Rock Tremolo',
        code: `// surf rock tremolo guitar
$: note("e4 e4 e4 e4 g4 g4 g4 g4")
  .s("gm_clean_guitar")
  .velocity(perlin.range(.3,.6).fast(8)).room(.4).delay(.2)
$: note("e2 ~ e2 g2 a2 ~ e2 ~").s("gm_electric_bass_pick").velocity(.5)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Jangle Pop Strum',
        code: `// jangle pop strumming
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_clean_guitar").velocity(.45).room(.35)
$: note("c4 e4 g4 c5 g4 e4 c4 e4")
  .s("gm_steel_guitar").velocity(.3).delay(.15)
$: note("c2 c2 a2 a2 f2 f2 g2 g2").s("gm_electric_bass_finger").velocity(.45)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Metal Power Chords',
        code: `// metal power chord riff
$: note("[e2,b2,e3] ~ [g2,d3,g3] [a2,e3,a3] ~ [e2,b2,e3] ~ ~")
  .s("gm_distortion_guitar").velocity(.7).room(.25)
$: note("e1 ~ g1 a1 ~ e1 ~ ~").s("gm_synth_bass_1").velocity(.65)
$: s("bd bd sd ~ bd bd sd bd").bank("RolandTR909").gain(.6)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.35)`,
      },
      {
        label: 'Bossa Nova Guitar',
        code: `// bossa nova guitar comp
$: note("[d3,a3,d4] ~ [d3,a3,d4] ~ [c3,g3,c4] ~ [c3,g3,c4] ~")
  .s("gm_nylon_guitar").velocity(.4).room(.3)
$: note("d2 ~ a2 ~ c2 ~ g2 ~").s("gm_acoustic_bass").velocity(.45)
$: s("~ rim ~ rim ~ rim ~ rim").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Reggae Skank',
        code: `// reggae guitar skank
$: note("~ [b3,d4,f4] ~ [b3,d4,f4] ~ [a3,c4,e4] ~ [a3,c4,e4]")
  .s("gm_muted_guitar").velocity(.5).room(.2)
$: note("~ b2 ~ b2 ~ a2 ~ a2").s("gm_electric_bass_finger").velocity(.55)
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
$: s("~ ~ hh ~ ~ ~ hh ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Country Chicken Pick',
        code: `// country chicken pickin
$: note("e4 a4 a4 b4 a4 a4 e4 d4")
  .s("gm_clean_guitar").velocity("<.6 .4 .5 .6>").room(.25)
$: note("a2 e3 a2 e3 d3 a3 e3 b3").s("gm_steel_guitar").velocity(.35)
$: note("a2 ~ e2 ~ d2 ~ e2 ~").s("gm_acoustic_bass").velocity(.45)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Shoegaze Shimmer',
        code: `// shoegaze shimmer guitar
$: note("<[e4,b4] [c4,g4] [a3,e4] [d4,a4]>")
  .s("gm_clean_guitar").velocity(.35)
  .room(.8).delay(.4).delayfeedback(.6).slow(4)
$: note("<e3 c3 a2 d3>")
  .s("gm_distortion_guitar").velocity(.3).room(.7).slow(4)
$: s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.3)`,
      },
      {
        label: 'Jazz Comping Guitar',
        code: `// jazz guitar comping
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_clean_guitar").velocity(.4).room(.3).slow(2)
$: note("d2 a2 g2 d3 c2 g2 f2 c3").s("gm_acoustic_bass").velocity(.45)
$: s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Funk Wah Guitar',
        code: `// funk wah guitar rhythm
$: note("e3 ~ [e3,g3] ~ e3 [e3,g3] ~ e3")
  .s("gm_muted_guitar").velocity(.55).lpf(sine.range(400,3000).fast(4))
$: note("e2 ~ e2 g2 ~ e2 ~ g2").s("gm_slap_bass_1").velocity(.55)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
$: s("oh ~ hh hh oh ~ hh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Classical Duet',
        code: `// classical guitar duet  
$: note("e4 f4 g4 a4 b4 c5 b4 a4")
  .s("gm_nylon_guitar").velocity(.45).room(.4)
$: note("c3 e3 g3 c3 d3 f3 a3 d3")
  .s("gm_nylon_guitar").velocity(.35).room(.4)`,
      },
      {
        label: 'Grunge Riff',
        code: `// grunge guitar riff
$: note("[e2,b2] ~ [g2,d3] ~ [a2,e3] ~ [e2,b2] [f2,c3]")
  .s("gm_distortion_guitar").velocity(.65).room(.3)
$: note("e1 ~ g1 ~ a1 ~ e1 f1").s("gm_electric_bass_pick").velocity(.6)
$: s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR909").gain(.55)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR909").gain(.35)`,
      },
      {
        label: 'Harmonics Sparkle',
        code: `// guitar harmonics sparkle
$: note("e5 b4 g5 d5 ~ e5 b4 ~")
  .s("gm_guitar_harmonics").velocity(.4).room(.6).delay(.3)
$: note("e3 b3 g3 d4 b3 g3 e3 b2")
  .s("gm_nylon_guitar").velocity(.3).room(.4)`,
      },
      {
        label: 'Rockabilly Twang',
        code: `// rockabilly twang guitar
$: note("e4 g4 a4 b4 ~ e4 g4 b4")
  .s("gm_steel_guitar").velocity(.55).room(.25).delay(.1)
$: note("e2 b2 e2 b2 a2 e3 a2 e3").s("gm_acoustic_bass").velocity(.5)
$: s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Slide Guitar Blues',
        code: `// slide guitar blues
$: note("e3 ~ g3 a3 ~ b3 a3 g3")
  .s("gm_steel_guitar").velocity(sine.range(.35,.6).slow(4)).room(.4)
$: note("[e3,b3] ~ [a3,e4] ~ [b3,g4] ~ [e3,b3] ~")
  .s("gm_clean_guitar").velocity(.3).slow(2)
$: note("e2 ~ a2 ~ b2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.45)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Ambient Guitar Pad',
        code: `// ambient guitar pad
$: note("<c4 e4 g4 b4>")
  .s("gm_clean_guitar").velocity(.3)
  .room(.85).delay(.5).delayfeedback(.65).slow(4)
$: note("<[c3,g3] [a2,e3] [f2,c3] [g2,d3]>")
  .s("gm_clean_guitar").velocity(.2).room(.7).slow(8)`,
      },
      {
        label: 'Acoustic Folk Strum',
        code: `// acoustic folk strumming
$: note("<[g3,b3,d4] [c3,e3,g3] [d3,g3,a3] [g3,b3,d4]>")
  .s("gm_steel_guitar").velocity(.5).room(.35)
$: note("g3 b3 d4 g4 d4 b3 g3 b3")
  .s("gm_steel_guitar").velocity(.3)
$: note("g2 g2 c2 c2 d2 d2 g2 g2").s("gm_acoustic_bass").velocity(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)`,
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
$: s("~ cp ~ ~").bank("RolandTR909").gain(.7)`,
      },
      {
        label: 'Double Clap',
        code: `// doubled clap hit
$: s("~ [cp cp] ~ ~").bank("RolandTR909").gain(.65)
  .room(.15)`,
      },
      {
        label: 'Clap Stack',
        code: `// layered 808+909 claps
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("~ cp ~ ~").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Off-Beat Claps',
        code: `// off-beat clap groove
$: s("~ cp ~ [~ cp]").bank("RolandTR808").gain(.65)
$: s("bd ~ bd ~").bank("RolandTR808").gain(.8)`,
      },
      {
        label: 'Triplet Claps',
        code: `// triplet clap pattern
$: s("cp(3,8)").bank("RolandTR909").gain(.6)
$: s("bd*4").gain(.8)`,
      },
      {
        label: 'Clap Roll',
        code: `// clap roll buildup
$: s("[~ ~ ~ ~] [~ ~ cp ~] [~ cp cp ~] [cp cp cp cp]")
  .bank("RolandTR909").gain(.6)`,
      },
      {
        label: 'Clap + Snare',
        code: `// clap layered with snare
$: s("~ [cp sd] ~ [cp sd]").bank("RolandTR808")
  .gain(.65).room(.2)`,
      },
      {
        label: 'Delayed Clap',
        code: `// clap with echo
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
  .delay(.4).delayfeedback(.5).room(.3)`,
      },
      {
        label: 'Reverb Clap',
        code: `// reverb-soaked clap
$: s("~ cp ~ ~").bank("RolandTR909").gain(.55)
  .room(.8).roomsize(6)`,
      },
      {
        label: 'Syncopated Claps',
        code: `// syncopated clap groove
$: s("~ cp ~ cp ~ ~ cp ~").bank("RolandTR808").gain(.6)
$: s("bd*4").gain(.8)`,
      },
      {
        label: 'Clap Gate',
        code: `// gated clap stutter
$: s("cp*8").bank("RolandTR909")
  .gain("[0 .5 0 .6 0 .5 0 .7]")`,
      },
      {
        label: 'Clap Shuffle',
        code: `// shuffled clap feel
$: s("~ cp [~ cp] ~").bank("RolandTR909").gain(.6)
$: s("bd [~ bd] bd ~").gain(.8)`,
      },
      {
        label: 'Clap Flam',
        code: `// flam clap hit
$: s("~ [cp:0 cp:1] ~ ~").bank("RolandTR808")
  .gain("[.3 .6]").room(.2)`,
      },
      {
        label: 'Clap Euclidean',
        code: `// euclidean clap pattern
$: s("cp(5,16)").bank("RolandTR909").gain(.55)
$: s("bd(3,8)").gain(.8)`,
      },
      {
        label: 'Trap Clap',
        code: `// trap style clap
$: s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.7)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.85)`,
      },
      {
        label: 'Garage Clap',
        code: `// 2-step garage clap
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("bd ~ [~ bd] ~").bank("RolandTR909").gain(.8)
$: s("[hh hh hh ~]*2").gain(.4)`,
      },
      {
        label: 'Clap Panned',
        code: `// stereo clap spread
$: s("~ cp ~ cp").bank("RolandTR909")
  .gain(.55).pan("<.2 .8>")`,
      },
      {
        label: 'Crushed Clap',
        code: `// bit-crushed clap
$: s("~ cp ~ ~").bank("RolandTR808").gain(.6)
  .crush(8)`,
      },
      {
        label: 'Clap Drive',
        code: `// driving clap pattern
$: s("cp*4").bank("RolandTR909")
  .gain("[.3 .6 .35 .65]")`,
      },
      {
        label: 'Reggaeton Clap',
        code: `// reggaeton clap
$: s("~ ~ cp ~ ~ ~ cp ~").bank("RolandTR808").gain(.6)
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.85)`,
      },
      {
        label: 'Afro Clap',
        code: `// afrobeat clap
$: s("cp(2,8)").bank("RolandTR808").gain(.55)
$: s("bd(3,8)").bank("RolandTR808").gain(.8)
$: s("rim(5,8)").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'DnB Clap',
        code: `// drum and bass clap
$: s("[~ ~ ~ ~] [~ cp ~ ~]").bank("RolandTR909").gain(.65)
$: s("[bd ~ bd ~] [~ ~ bd ~]").gain(.85)`,
      },
      {
        label: 'Minimal Clap',
        code: `// minimal clap tick
$: s("~ cp ~ ~").gain(.5)
$: s("bd*4").gain(.7)
$: s("hh*16").gain("[.15 .25]*8")`,
      },
      {
        label: 'Clap + Rim',
        code: `// clap and rim combo
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: s("rim*8").bank("RolandTR909").gain("[.15 .3]*4")`,
      },
      {
        label: 'Pitched Clap',
        code: `// pitched clap melody
$: s("cp cp cp cp").bank("RolandTR808")
  .speed("<1 1.25 .85 1.5>").gain(.55)`,
      },
      {
        label: 'Clap Delay Tail',
        code: `// long delay tail clap
$: s("~ ~ ~ cp").bank("RolandTR909").gain(.5)
  .delay(.6).delayfeedback(.7).room(.4)`,
      },
      {
        label: 'Lo-Fi Clap',
        code: `// lo-fi dusty clap
$: s("~ cp ~ ~").bank("RolandTR808").gain(.5)
  .lpf(2000).room(.3)`,
      },
      {
        label: 'Polyrhythm Clap',
        code: `// polyrhythm claps
$: s("cp(3,8)").bank("RolandTR909").gain(.5)
$: s("cp(5,8)").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'House Clap',
        code: `// four-on-floor clap
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.65)
$: s("[~ hh]*4").bank("RolandTR909").gain(.45)`,
      },
      {
        label: 'Clap Fill',
        code: `// clap fill pattern
$: s("~ cp ~ ~, ~ ~ [cp cp] ~, ~ ~ ~ [~ cp]")
  .bank("RolandTR909").gain(.55)`,
      },
      {
        label: 'Trap Clap Rolls',
        code: `// trap style clap rolls
$: s("~ ~ cp ~ ~ ~ [cp cp cp] ~")
  .bank("RolandTR808").gain(.6)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
$: s("hh hh hh hh hh oh hh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Gospel Clap',
        code: `// gospel hand clap groove
$: s("~ cp ~ cp").bank("RolandTR909").gain(.65)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.5)
$: note("[c4,e4,g4] ~ [f4,a4,c5] ~").s("gm_church_organ").velocity(.3).slow(2)`,
      },
      {
        label: 'Swing Clap',
        code: `// swing feel clap
$: s("~ cp ~ [~ cp]").bank("RolandTR909").gain(.55)
$: s("bd ~ bd ~").bank("RolandTR909").gain(.45)
$: s("[hh ~] [hh hh] [hh ~] [hh hh]").bank("RolandTR909").gain(.3)`,
      },
      {
        label: 'Stadium Clap',
        code: `// stadium crowd clap
$: s("cp ~ cp ~").bank("RolandTR808").gain(.7).room(.6)
$: s("~ ~ cp ~").bank("RolandTR909").gain(.4).room(.6).delay(.15)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Polyrhythm Clap',
        code: `// polyrhythmic clap pattern
$: s("cp ~ ~ cp ~ ~").bank("RolandTR909").gain(.55)
$: s("~ cp ~ ~ cp ~").bank("RolandTR808").gain(.45)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Clap Delay Trail',
        code: `// clap with long delay trail
$: s("~ cp ~ ~").bank("RolandTR909").gain(.5)
  .delay(.35).delayfeedback(.6).room(.4)
$: s("bd ~ sd ~").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Double Time Clap',
        code: `// double time clap rhythm
$: s("~ cp ~ cp ~ cp ~ cp").bank("RolandTR909").gain(.5)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Flam Clap',
        code: `// flam clap accents
$: s("~ [cp ~ cp] ~ ~").bank("RolandTR909").gain("<.5 .6 .55 .65>")
  .room(.2)
$: s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Afro Clap Pattern',
        code: `// afrobeat clap pattern
$: s("~ cp ~ ~ cp ~ cp ~").bank("RolandTR808").gain(.55)
$: s("bd ~ bd ~ ~ bd ~ bd").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Clap + Snap Layer',
        code: `// layered clap with rim snap
$: s("~ cp ~ ~").bank("RolandTR909").gain(.55)
$: s("~ rim ~ ~").bank("RolandTR808").gain(.35).delay(.05)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'House Clap Groove',
        code: `// classic house clap
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6).room(.15)
$: s("bd bd bd bd").bank("RolandTR909").gain(.6)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.35)
$: note("~ ~ c4 ~").s("gm_epiano1").velocity(.2)`,
      },
      {
        label: 'Reggaeton Clap',
        code: `// reggaeton clap dembow
$: s("~ ~ cp ~ ~ ~ cp ~").bank("RolandTR808").gain(.6)
$: s("bd ~ ~ bd ~ bd ~ ~").bank("RolandTR808").gain(.55)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Buildup Clap',
        code: `// buildup accelerating clap
$: s("cp ~ ~ ~ cp ~ cp [cp cp cp cp]")
  .bank("RolandTR909").gain(sine.range(.3,.7).slow(4))
$: s("bd ~ ~ ~ bd ~ bd bd").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Minimal Clap',
        code: `// minimal techno clap
$: s("~ cp ~ ~").bank("RolandTR909").gain(.5)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.55)
$: s("hh ~ hh ~ hh ~ hh ~").bank("RolandTR909").gain(.2)
$: s("~ ~ ~ rim ~ ~ ~ ~").bank("RolandTR808").gain(.25)`,
      },
      {
        label: 'Dancehall Clap',
        code: `// dancehall clap riddim
$: s("~ cp cp ~ ~ cp ~ cp").bank("RolandTR808").gain(.55)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.5)
$: s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Syncopated Clap',
        code: `// syncopated clap groove
$: s("~ cp ~ [~ cp] ~ cp ~ ~").bank("RolandTR909").gain(.5)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
$: note("c3 ~ e3 ~ f3 ~ e3 ~").s("gm_synth_bass_1").velocity(.3)`,
      },
      {
        label: 'Clap Gate',
        code: `// gated clap rhythm
$: s("cp cp ~ cp cp ~ cp ~")
  .bank("RolandTR909").gain("<.5 .3 .6 .4 .5 .3 .6 .4>")
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Latin Clap',
        code: `// latin clave with clap
$: s("cp ~ ~ cp ~ cp ~ ~").bank("RolandTR808").gain(.5)
$: s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.35)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.45)
$: note("~ a2 ~ a2 ~ c3 ~ a2").s("gm_acoustic_bass").velocity(.4)`,
      },
      {
        label: 'Philly Soul Clap',
        code: `// philly soul clap groove
$: s("~ cp ~ cp").bank("RolandTR909").gain(.55).room(.2)
$: s("bd ~ ~ ~ bd ~ ~ bd").bank("RolandTR808").gain(.45)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)
$: note("[c4,e4,g4] ~ [f4,a4,c5] ~").s("gm_strings1").velocity(.2).slow(2)`,
      },
      {
        label: 'Stacked Clap Hit',
        code: `// stacked multi-layer clap
$: s("~ cp ~ ~").bank("RolandTR808").gain(.5)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.45).delay(.02)
$: s("~ sd ~ ~").bank("RolandTR808").gain(.3)
$: s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)`,
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
$: note("c4 ~ ~ e4 ~ ~ g4 ~")
  .s("piano").gain(.45)
  .room(.95).roomsize(10)`,
      },
      {
        label: 'Infinite Verb',
        code: `// infinite reverb wash
$: note("c4").s("sine").gain(.3)
  .room(.99).roomsize(12)
  .delay(.5).delayfeedback(.7)`,
      },
      {
        label: 'Shimmer Pad',
        code: `// shimmering reverb pad
$: note("<[c3,g3,c4] [a2,e3,a3]>")
  .s("sine").gain(.3)
  .room(.9).roomsize(8)
  .delay(.3).delayfeedback(.5).slow(4)`,
      },
      {
        label: 'Plate Snare',
        code: `// plate reverb on snare
$: s("~ sd ~ sd").gain(.65)
  .room(.7).roomsize(4)
$: s("bd*4").gain(.8)`,
      },
      {
        label: 'Hall Strings',
        code: `// concert hall strings
$: note("<[c3,e3,g3,c4] [a2,c3,e3,a3]>")
  .s("gm_strings1").velocity(.4)
  .room(.85).roomsize(8).slow(4)`,
      },
      {
        label: 'Reverb Hats',
        code: `// reverb-soaked hi-hats
$: s("hh*8").gain("[.3 .5]*4")
  .room(.6).roomsize(4)
$: s("bd*4").gain(.8)`,
      },
      {
        label: 'Ambient Bell',
        code: `// reverb bell tones
$: note("<c5 e5 g5 b5>")
  .s("gm_tubular_bells").velocity(.35)
  .room(.9).roomsize(8).slow(2)`,
      },
      {
        label: 'Verb + Delay',
        code: `// reverb and delay combo
$: note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("piano").gain(.4)
  .room(.7).roomsize(5)
  .delay(.4).delayfeedback(.5)`,
      },
      {
        label: 'Gated Verb',
        code: `// gated reverb snare
$: s("~ sd ~ sd").gain(.7)
  .room(.8).roomsize(3)
$: s("bd*4").gain(.85)`,
      },
      {
        label: 'Spring Verb',
        code: `// spring reverb guitar
$: note("e3 g3 a3 b3 e4 b3 a3 g3")
  .s("gm_clean_guitar").velocity(.45)
  .room(.6).roomsize(3)`,
      },
      {
        label: 'Reverse Verb',
        code: `// reverse reverb feel
$: note("[c4,e4,g4]").s("supersaw")
  .gain(.3).attack(.5)
  .room(.9).roomsize(8).slow(4)`,
      },
      {
        label: 'Vocal Cathedral',
        code: `// vocal in cathedral
$: s("chin:0 ~ chin:1 ~").gain(.5)
  .room(.95).roomsize(10).slow(2)`,
      },
      {
        label: 'Reverb Wash',
        code: `// pad reverb wash
$: note("[c3,e3,g3]").s("sawtooth")
  .gain(.25).lpf(1500)
  .room(.9).roomsize(8)`,
      },
      {
        label: 'Subtle Room',
        code: `// subtle room ambience
$: note("c4 e4 g4 c5 g4 e4")
  .s("piano").gain(.5)
  .room(.3).roomsize(2)`,
      },
      {
        label: 'Huge Verb',
        code: `// massive reverb space
$: note("c3").s("sine").gain(.35)
  .room(.95).roomsize(12)
  .lpf(800)`,
      },
      {
        label: 'Choir Hall',
        code: `// choir in concert hall
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.85).roomsize(7).slow(4)`,
      },
      {
        label: 'Wet Drums',
        code: `// fully wet drum reverb
$: s("bd sd:2 [~ bd] sd").bank("RolandTR808")
  .gain(.6).room(.8).roomsize(6)`,
      },
      {
        label: 'Small Room',
        code: `// small room feel
$: note("c4 e4 g4 c5")
  .s("gm_vibraphone").velocity(.45)
  .room(.25).roomsize(1)`,
      },
      {
        label: 'Verb Swell',
        code: `// reverb swell pad
$: note("<[c3,g3,c4]>")
  .s("sine")
  .gain(sine.range(.1,.4).slow(8))
  .room(.9).roomsize(8)`,
      },
      {
        label: 'Echo Chamber',
        code: `// echo chamber effect
$: note("c4 ~ ~ ~ e4 ~ ~ ~")
  .s("piano").gain(.4)
  .room(.7).roomsize(5)
  .delay(.3).delayfeedback(.6)`,
      },
      {
        label: 'Verb Piano Chord',
        code: `// reverb piano chords
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("piano").gain(.4)
  .room(.8).roomsize(6).slow(2)`,
      },
      {
        label: 'Ethereal Sine',
        code: `// ethereal sine reverb
$: note("c5 e5 g5 b5")
  .s("sine").gain(.3)
  .room(.9).roomsize(8)
  .delay(.4).delayfeedback(.5).slow(2)`,
      },
      {
        label: 'Frozen Verb',
        code: `// frozen reverb drone
$: note("[c2,g2]").s("sawtooth")
  .gain(.2).lpf(500)
  .room(.99).roomsize(12)`,
      },
      {
        label: 'Harp Reverb',
        code: `// harp with reverb
$: n("0 2 4 5 7 9 11 12")
  .scale("C4:major")
  .s("gm_harp").velocity(.4)
  .room(.7).roomsize(5).slow(2)`,
      },
      {
        label: 'Rim Plate',
        code: `// rim with plate verb
$: s("rim*4").gain(.4)
  .room(.6).roomsize(3)
$: s("bd ~ bd ~").gain(.7)`,
      },
      {
        label: 'Spacious Keys',
        code: `// spacious electric piano
$: note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.75).roomsize(5).slow(2)`,
      },
      {
        label: 'Verb Bass',
        code: `// reverb bass tone
$: note("<c2 e2 f2 g2>")
  .s("sine").gain(.45)
  .room(.5).roomsize(3)
  .lpf(300)`,
      },
      {
        label: 'Guitar Hall',
        code: `// guitar in hall
$: note("e3 g3 b3 e4")
  .s("gm_nylon_guitar").velocity(.4)
  .room(.8).roomsize(6).slow(2)`,
      },
      {
        label: 'Synth Cathedral',
        code: `// synth in cathedral
$: note("[c3,e3,g3]").s("supersaw")
  .gain(.25).lpf(2000)
  .room(.9).roomsize(8)`,
      },
      {
        label: 'Reverb Everything',
        code: `// everything reverbed
$: s("bd sd [~ bd] sd").bank("RolandTR808").gain(.6).room(.6)
$: note("<[c3,e3,g3]>")
  .s("piano").gain(.4).room(.8).roomsize(6)
$: note("c2").s("sine").gain(.4).room(.5)`,
      },
      {
        label: 'Spring Reverb Guitar',
        code: `// spring reverb guitar twang
$: note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_clean_guitar").velocity(.45)
  .room(.65).roomsize(3).delay(.1)
$: note("e2 ~ a2 ~ b2 ~ e2 ~").s("gm_acoustic_bass").velocity(.4).room(.3)`,
      },
      {
        label: 'Plate Verb Piano',
        code: `// plate reverb on piano
$: note("c4 e4 g4 c5 g4 e4 c4 ~")
  .s("gm_grandpiano").velocity(.5)
  .room(.75).roomsize(5)
$: note("<[c3,e3,g3] [a2,c3,e3]>").s("gm_grandpiano").velocity(.25).room(.6).slow(4)`,
      },
      {
        label: 'Verb Snare Wash',
        code: `// massive reverb snare wash
$: s("~ sd ~ ~").bank("RolandTR909").gain(.55)
  .room(.9).roomsize(8)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR909").gain(.5).room(.3)
$: s("hh hh hh hh").bank("RolandTR909").gain(.25).room(.2)`,
      },
      {
        label: 'Hall Strings',
        code: `// concert hall strings
$: note("<[c4,e4,g4] [d4,f4,a4] [e4,g4,b4] [c4,e4,g4]>")
  .s("gm_strings1").velocity(.5)
  .room(.85).roomsize(9).slow(4)
$: note("c3 d3 e3 c3").s("gm_cello").velocity(.3).room(.7).slow(4)`,
      },
      {
        label: 'Ambient Verb Pad',
        code: `// ambient reverb pad
$: note("<[c4,e4,g4] [b3,d4,f4]>")
  .s("gm_warm_pad").velocity(.35)
  .room(.9).roomsize(10).slow(8)
$: note("c5 ~ e5 ~ g5 ~ ~ ~")
  .s("gm_celesta").velocity(.2).room(.8).delay(.3)`,
      },
      {
        label: 'Gated Verb Drums',
        code: `// gated reverb drums
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.6)
  .room(.7).roomsize(4).decay(.1)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3).room(.2)
$: note("c2 ~ c2 ~").s("sine").gain(.35).room(.3)`,
      },
      {
        label: 'Shimmer Verb',
        code: `// shimmer reverb effect
$: note("c5 e5 g5 b5 g5 e5 c5 ~")
  .s("gm_music_box").velocity(.35)
  .room(.85).roomsize(8).delay(.25).delayfeedback(.5)
$: note("<[c4,g4] [a3,e4]>").s("gm_halo_pad").velocity(.2).room(.7).slow(8)`,
      },
      {
        label: 'Reverse Verb Feel',
        code: `// reverse reverb feel
$: note("~ ~ ~ c4 ~ ~ ~ e4")
  .s("gm_voice_oohs").velocity(.4)
  .room(.8).roomsize(7).delay(.4).delayfeedback(.55)
$: s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.4).room(.5)`,
      },
      {
        label: 'Room Drum Kit',
        code: `// room mic drum kit
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5).room(.45).roomsize(3)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3).room(.35)
$: s("~ ~ ~ ~ ~ ~ ~ rim").bank("RolandTR808").gain(.25).room(.4)`,
      },
      {
        label: 'Verb Choir Swell',
        code: `// reverb choir swell
$: note("[c4,e4,g4,c5]")
  .s("gm_choir_aahs").velocity(sine.range(.15,.55).slow(8))
  .room(.85).roomsize(9).slow(4)
$: note("[c3,g3]").s("gm_church_organ").velocity(.2).room(.7).slow(4)`,
      },
      {
        label: 'Tight Room Bass',
        code: `// tight room on bass
$: note("c2 ~ e2 ~ f2 ~ e2 ~")
  .s("gm_electric_bass_finger").velocity(.55)
  .room(.25).roomsize(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45).room(.2)`,
      },
      {
        label: 'Cavernous Hits',
        code: `// cavernous percussion hits
$: s("bd ~ ~ ~ ~ ~ ~ ~").bank("RolandTR808").gain(.6)
  .room(.95).roomsize(10)
$: s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.5)
  .room(.9).roomsize(9)
$: note("~ ~ ~ ~ ~ ~ ~ c5").s("gm_tubular_bells").velocity(.3).room(.85)`,
      },
      {
        label: 'Verb Flute Echo',
        code: `// reverbed flute echo
$: note("g5 a5 b5 d6 b5 a5 g5 ~")
  .s("gm_flute").velocity(.4)
  .room(.75).delay(.2).delayfeedback(.4)
$: note("<[g3,b3,d4] [c4,e4,g4]>").s("gm_warm_pad").velocity(.2).room(.6).slow(4)`,
      },
      {
        label: 'Wet Dry Mix',
        code: `// wet/dry reverb contrast
$: note("c4 e4 g4 c5").s("gm_epiano1").velocity(.45).room(.8).roomsize(6)
$: note("c4 e4 g4 c5").s("gm_epiano2").velocity(.35).room(.1)
$: s("bd ~ sd ~").bank("RolandTR808").gain(.4).room(.15)`,
      },
      {
        label: 'Space Harp',
        code: `// space harp with deep reverb
$: note("c4 e4 g4 c5 e5 c5 g4 e4")
  .s("gm_harp").velocity(.4)
  .room(.85).roomsize(8).delay(.15)
$: note("<[c3,g3,c4]>").s("gm_harp").velocity(.2).room(.7).slow(8)`,
      },
      {
        label: 'Verb Trail Build',
        code: `// reverb trail buildup
$: note("c4 ~ ~ ~ d4 ~ ~ ~ e4 ~ ~ ~ g4 ~ ~ ~")
  .s("gm_vibraphone").velocity(sine.range(.2,.5).slow(4))
  .room(sine.range(.3,.9).slow(4)).slow(2)
$: s("~ ~ ~ ~ ~ ~ ~ bd").bank("RolandTR808").gain(.3).room(.5)`,
      },
      {
        label: 'Dual Verb Space',
        code: `// dual reverb spaces
$: note("e4 g4 b4 e5").s("gm_grandpiano").velocity(.4)
  .room(.85).roomsize(8)
$: note("e3 g3 b3 e4").s("gm_epiano1").velocity(.35)
  .room(.35).roomsize(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.4).room(.3)`,
      },
      {
        label: 'Frozen Verb Pad',
        code: `// frozen reverb pad texture
$: note("<c4 e4 g4 b4>")
  .s("gm_bowed_glass").velocity(.3)
  .room(.95).roomsize(10).delay(.4).delayfeedback(.6).slow(4)`,
      },
      {
        label: 'Verb Percussion',
        code: `// reverbed world percussion
$: s("bd ~ rim ~ bd rim ~ ~").bank("RolandTR808").gain(.45).room(.55)
$: note("c4 ~ e4 ~ g4 ~ c4 ~").s("gm_kalimba").velocity(.35).room(.65)
$: note("~ c5 ~ e5 ~ g5 ~ ~").s("gm_xylophone").velocity(.25).room(.7)`,
      },
      {
        label: 'Verb Feedback Loop',
        code: `// reverb feedback loop
$: note("c5 ~ ~ ~ ~ ~ ~ ~")
  .s("gm_crystal").velocity(.35)
  .room(.9).roomsize(10).delay(.5).delayfeedback(.7)
$: note("~ ~ ~ ~ g4 ~ ~ ~")
  .s("gm_crystal").velocity(.25)
  .room(.85).delay(.45).delayfeedback(.65)`,
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
$: note("c1*2").s("sine")
  .gain(.7).shape(.4)
  .lpf(100)`,
      },
      {
        label: 'Wobble Monster',
        code: `// massive wobble bass
$: note("c1").s("sawtooth")
  .gain(.55)
  .lpf(sine.range(100,3000).fast(4))
  .lpq(12).shape(.3)`,
      },
      {
        label: 'Reese Heavyweight',
        code: `// heavyweight reese
$: note("<c1 c1 e1 f1>")
  .s("sawtooth").gain(.5)
  .detune(20).lpf(400)
  .shape(.4)`,
      },
      {
        label: 'Distorted Sub',
        code: `// distorted sub bass
$: note("<c1 e1 f1 g1>")
  .s("sine").gain(.6)
  .shape(.6).lpf(200)`,
      },
      {
        label: '808 Long',
        code: `// long 808 bass
$: note("c1 ~ ~ ~ e1 ~ ~ ~")
  .s("sine").gain(.65)
  .decay(1.5).lpf(180)
  .shape(.3)`,
      },
      {
        label: 'Growl Bass',
        code: `// growling bass
$: note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,1500).fast(8))
  .lpq(15).shape(.35)`,
      },
      {
        label: 'Foghorn',
        code: `// foghorn sub
$: note("c1").s("sawtooth")
  .gain(.5).shape(.5)
  .lpf(200).lpq(4)`,
      },
      {
        label: 'Earthquake',
        code: `// earthquake rumble
$: note("c0*2").s("sine")
  .gain(.6).shape(.4)
  .lpf(80)`,
      },
      {
        label: 'Dirty Square',
        code: `// dirty square bass
$: note("c1 ~ c1 e1 ~ e1 f1 ~")
  .s("square").gain(.5)
  .shape(.4).lpf(300)`,
      },
      {
        label: 'DnB Tear',
        code: `// tearing DnB bass
$: note("[c1 ~] [~ g1] [e1 ~] [~ c1]")
  .s("sawtooth").gain(.55)
  .lpf(1000).shape(.3)`,
      },
      {
        label: 'Dubstep Wub',
        code: `// dubstep wub wub
$: note("c1*2").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,2500).fast(6))
  .lpq(10).shape(.35)`,
      },
      {
        label: 'Brostep',
        code: `// brostep screech bass
$: note("c1*4").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(200,4000).fast(8))
  .lpq(15).shape(.3).crush(10)`,
      },
      {
        label: 'Wall of Bass',
        code: `// wall of sub bass
$: note("[c1,g1]").s("sawtooth")
  .gain(.45).shape(.5)
  .lpf(300)`,
      },
      {
        label: 'Filtered Rumble',
        code: `// filtered bass rumble
$: note("c1*4").s("sine")
  .gain("[.4 .6 .5 .7]")
  .shape(.4).lpf(sine.range(60,200).slow(4))`,
      },
      {
        label: 'Neuro Bass',
        code: `// neuro bass
$: note("c1 c1 [c1 e1] c1")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,2000).fast(4))
  .shape(.3).crush(12)`,
      },
      {
        label: 'Phat 5ths',
        code: `// phat fifth bass
$: note("<[c1,g1] [e1,b1] [f1,c2] [g1,d2]>")
  .s("sawtooth").gain(.45)
  .shape(.35).lpf(500)`,
      },
      {
        label: 'Aggressive Saw',
        code: `// aggressive saw bass
$: note("c1 ~ c1 c1 ~ c1 e1 ~")
  .s("sawtooth").gain(.5)
  .shape(.45).lpf(600)
  .decay(.1)`,
      },
      {
        label: 'Chest Thump',
        code: `// chest-thumping sub
$: note("c1*4").s("sine")
  .gain(.65).shape(.5)
  .lpf(80).decay(.4)`,
      },
      {
        label: 'Trap Sub',
        code: `// deep trap 808 sub
$: note("c1 ~ ~ ~ ~ ~ e1 ~")
  .s("sine").gain(.6)
  .decay(1.2).shape(.3)
  .lpf(150)`,
      },
      {
        label: 'Riddim Bass',
        code: `// riddim dubstep bass
$: note("c1*4").s("sawtooth")
  .gain(.5)
  .lpf(sine.range(100,1800).fast(2))
  .lpq(12).shape(.4)`,
      },
      {
        label: 'Detuned Terror',
        code: `// detuned terror bass
$: note("c1").s("sawtooth")
  .gain(.45).detune(25)
  .shape(.45).lpf(400)`,
      },
      {
        label: 'Layered Low',
        code: `// layered low-end
$: note("<c1 e1 f1 g1>").s("sine")
  .gain(.55).shape(.35).lpf(120)
$: note("<c2 e2 f2 g2>").s("sawtooth")
  .gain(.3).lpf(600).shape(.2)`,
      },
      {
        label: 'Punchy Low',
        code: `// punchy sub hit
$: note("c1 ~ ~ c1 ~ ~ c1 c1")
  .s("sine").gain(.6)
  .decay(.15).shape(.5)
  .lpf(100)`,
      },
      {
        label: 'Acid Scream',
        code: `// acid scream bass
$: note("c2 [~ c2] e2 [c2 g1]")
  .s("sawtooth").gain(.5)
  .lpf(sine.range(200,5000).fast(2))
  .lpq(18).shape(.3)`,
      },
      {
        label: 'FM Heavy',
        code: `// FM modulated heavy bass
$: note("<c1 e1 f1 g1>")
  .s("sine").gain(.5)
  .fmi(3).fmh(1)
  .shape(.3).lpf(300)`,
      },
      {
        label: 'Sine Pressure',
        code: `// sine bass pressure
$: note("c1").s("sine")
  .gain(sine.range(.3,.7).slow(4))
  .shape(.4).lpf(100)`,
      },
      {
        label: 'Flutter Bass',
        code: `// fluttering bass
$: note("c1*8").s("sawtooth")
  .gain("[.3 .5]*4")
  .lpf(sine.range(200,1000).fast(4))
  .shape(.3)`,
      },
      {
        label: 'Thunder Sub',
        code: `// thunderous sub drop
$: note("g1 ~ ~ ~ c1 ~ ~ ~")
  .s("sine").gain(.65)
  .decay(1).shape(.45)
  .lpf(120)`,
      },
      {
        label: 'Stacked Saws',
        code: `// triple stacked saws
$: note("c1").s("sawtooth")
  .gain(.35).detune(10).lpf(500)
$: note("c1").s("sawtooth")
  .gain(.35).detune(-10).lpf(500)
$: note("c1").s("sine").gain(.4).lpf(100)`,
      },
      {
        label: 'Bass Drop',
        code: `// bass drop effect
$: note("c3 c2 c1 c1")
  .s("sine").gain(.6)
  .shape(.4).lpf(200)
  .decay(.5)`,
      },
      {
        label: 'Seismic Sub',
        code: `// seismic sub bass rumble
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine")
  .gain(.7).lpf(80).shape(.3)
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("triangle")
  .gain(.3).lpf(120)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.6)`,
      },
      {
        label: 'Distorted Reese',
        code: `// distorted reese bass
$: note("c1 ~ ~ c1 ~ e1 ~ ~").s("sawtooth")
  .gain(.5).lpf(sine.range(100,800).slow(4)).shape(.5)
$: note("c1 ~ ~ c1 ~ e1 ~ ~").s("sawtooth")
  .gain(.45).detune(15).lpf(sine.range(120,700).slow(4)).shape(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.55)`,
      },
      {
        label: 'Massive 808 Slide',
        code: `// massive 808 bass slide
$: note("c1 ~ ~ ~ e1 ~ c1 ~").s("sine")
  .gain(.65).shape(.35).lpf(150).decay(.8)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.6)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Filthy Wobble',
        code: `// filthy wobble bass
$: note("c1 ~ c1 ~ c1 ~ c1 ~").s("sawtooth")
  .lpf(sine.range(80,2000).fast(2)).gain(.55).shape(.4)
$: note("c1").s("sine").gain(.3).lpf(60)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.55)`,
      },
      {
        label: 'Acid Screech',
        code: `// acid screech bass
$: note("c2 c2 e2 c2 f2 c2 e2 c2")
  .s("sawtooth").lpf(sine.range(200,4000).fast(4))
  .gain(.45).shape(.3).resonance(15)
$: s("bd bd bd bd").bank("RolandTR909").gain(.55)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)`,
      },
      {
        label: 'Growl Bass',
        code: `// growl bass texture
$: note("c1 ~ e1 ~ f1 ~ e1 ~").s("sawtooth")
  .lpf(sine.range(150,1200).fast(3)).gain(.5).shape(.45)
$: note("c1 ~ e1 ~ f1 ~ e1 ~").s("square")
  .lpf(400).gain(.25)
$: s("bd ~ sd ~ bd ~ sd bd").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Earthquake Sub',
        code: `// earthquake sub bass
$: note("c1*2").s("sine").gain(.7).lpf(60).shape(.25)
$: note("c1*2").s("triangle").gain(.35).lpf(90)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.6)
$: s("~ ~ ~ ~ ~ ~ ~ sd").bank("RolandTR808").gain(.4)`,
      },
      {
        label: 'Dubstep Tear',
        code: `// dubstep tear-out bass
$: note("c1 ~ c1 e1 ~ c1 f1 ~").s("sawtooth")
  .lpf(sine.range(100,3000).fast(8)).gain(.5).shape(.5)
$: s("bd ~ ~ ~ sd ~ ~ ~").bank("RolandTR909").gain(.6)
$: s("~ hh ~ hh ~ hh ~ oh").bank("RolandTR909").gain(.3)`,
      },
      {
        label: 'Analog Warmth',
        code: `// warm analog bass
$: note("c2 ~ g1 ~ c2 ~ e2 ~").s("sawtooth")
  .lpf(600).gain(.45).shape(.2).room(.15)
$: note("c2 ~ g1 ~ c2 ~ e2 ~").s("sine")
  .gain(.3).lpf(200)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'Neurofunk Bass',
        code: `// neurofunk bass patch
$: note("c1 ~ c1 c1 ~ ~ c1 ~").s("sawtooth")
  .lpf(sine.range(200,2500).fast(6)).gain(.5).shape(.45)
$: note("c1 ~ c1 c1 ~ ~ c1 ~").s("square")
  .lpf(sine.range(300,1800).fast(6)).gain(.3).shape(.3)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.55)`,
      },
      {
        label: 'Trap Low End',
        code: `// trap heavy low end
$: note("c1 ~ ~ ~ ~ ~ c1 ~").s("sine")
  .gain(.65).shape(.3).lpf(100).decay(.6)
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
$: s("hh hh hh hh oh hh hh hh").bank("RolandTR808").gain(.3)
$: s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'FM Bass Buzz',
        code: `// fm bass buzz
$: note("c1 ~ e1 ~ c1 ~ f1 ~").s("sine")
  .gain(.5).shape(.5).lpf(300)
$: note("c2 ~ e2 ~ c2 ~ f2 ~").s("square")
  .gain(.25).lpf(500)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Garage Bass Thump',
        code: `// garage heavy bass thump
$: note("c2 ~ ~ c2 ~ ~ e2 ~").s("sine")
  .gain(.6).shape(.3).lpf(150)
$: s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR808").gain(.3)
$: s("~ ~ ~ ~ ~ ~ ~ cp").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Distortion Chain',
        code: `// distortion chain bass
$: note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth")
  .gain(.45).shape(.6).lpf(400)
$: note("c1 ~ c1 ~ ~ ~ c1 ~").s("triangle")
  .gain(.35).shape(.4).lpf(250)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Phaser Bass',
        code: `// phaser bass sweep
$: note("c1 e1 c1 f1 c1 e1 c1 g1")
  .s("sawtooth").lpf(sine.range(200,1500).slow(2))
  .gain(.45).shape(.3)
$: note("c1 e1 c1 f1 c1 e1 c1 g1")
  .s("sine").gain(.3).lpf(100)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'Square Pulse Bass',
        code: `// square pulse bass
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("square")
  .gain(.5).lpf(300).shape(.35)
$: s("bd bd ~ ~ sd ~ bd ~").bank("RolandTR909").gain(.5)
$: s("hh hh hh hh hh oh hh hh").bank("RolandTR909").gain(.25)`,
      },
      {
        label: 'Stacked Octave Bass',
        code: `// stacked octave bass
$: note("c1 ~ e1 ~ f1 ~ e1 ~").s("sine").gain(.55).lpf(80)
$: note("c2 ~ e2 ~ f2 ~ e2 ~").s("sawtooth").gain(.3).lpf(500).shape(.3)
$: note("c3 ~ e3 ~ f3 ~ e3 ~").s("square").gain(.15).lpf(1000)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Detuned Fatness',
        code: `// detuned fat bass
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("sawtooth")
  .gain(.4).detune(20).lpf(400).shape(.3)
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("sawtooth")
  .gain(.4).detune(-20).lpf(400).shape(.3)
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine").gain(.3).lpf(80)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)`,
      },
      {
        label: 'Thunderous Kick Bass',
        code: `// thunderous kick-bass combo
$: note("c1 ~ ~ ~ c1 ~ ~ ~").s("sine")
  .gain(.7).shape(.4).lpf(70).decay(.4)
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.65)
$: s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(.5)
$: s("hh hh hh hh oh hh hh hh").bank("RolandTR808").gain(.25)`,
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
$: s("bd sd [~ bd] sd")
  .bank("RolandTR808").gain(.75)`,
      },
      {
        label: 'Loop Layer 2',
        code: `// add hi-hats to loop
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .6]")`,
      },
      {
        label: 'Loop Bass',
        code: `// bass loop layer
$: note("<c2 c2 f2 g2>")
  .s("sine").gain(.5)
  .lpf(200).shape(.15)`,
      },
      {
        label: 'Loop Chord',
        code: `// chord loop layer
$: note("<[c3,e3,g3] [a2,c3,e3]>")
  .s("supersaw").gain(.3)
  .lpf(1500).room(.3).slow(2)`,
      },
      {
        label: 'Loop Melody',
        code: `// melody loop layer
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("piano").gain(.5)`,
      },
      {
        label: 'Stacking Beats',
        code: `// stack beats together
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.6)
$: s("[~ hh]*4").gain(.4)`,
      },
      {
        label: 'Slow Build',
        code: `// slow build loop
$: s("bd ~ ~ ~").gain(.7)
$: s("~ ~ ~ rim").gain(.25)`,
      },
      {
        label: 'Add Perc',
        code: `// add percussion layer
$: s("rim(5,8)").gain(.3)
$: s("oh(2,8)").gain(.25).room(.3)`,
      },
      {
        label: 'Pad Layer',
        code: `// pad background layer
$: note("<[c3,g3,c4]>")
  .s("sine").gain(.25)
  .room(.6).roomsize(4).slow(4)`,
      },
      {
        label: 'FX Layer',
        code: `// FX texture layer
$: s("hh*16").gain("[.05 .1]*8")
  .lpf(sine.range(500,3000).slow(8))
  .room(.4)`,
      },
      {
        label: '2-Bar Loop',
        code: `// 2-bar repeating loop
$: s("bd sd [~ bd] sd bd [~ sd] bd sd")
  .bank("RolandTR808").gain(.75)`,
      },
      {
        label: '4-Bar Melody',
        code: `// 4-bar melody loop
$: note("<c4 e4 g4 b4 c5 b4 g4 f4 e4 c4 b3 c4 e4 g4 b4 c5>")
  .s("piano").gain(.5).slow(2)`,
      },
      {
        label: 'Polyrhythm Loop',
        code: `// polyrhythm loop layers
$: s("bd(3,8)").gain(.75)
$: s("cp(5,8)").gain(.5)
$: s("hh(7,8)").gain(.35)`,
      },
      {
        label: 'Ambient Loop',
        code: `// ambient loop texture
$: note("<[c3,g3]>").s("sine")
  .gain(.2).room(.8).roomsize(6)
$: s("hh*16").gain("[.03 .06]*8")
  .lpf(2000).room(.4)`,
      },
      {
        label: 'Vocal Loop',
        code: `// vocal chop loop
$: s("chin:0 ~ chin:1 ~")
  .gain(.5).room(.3)
  .speed("<1 1.2 .8 1>")`,
      },
      {
        label: 'Bass + Drums Loop',
        code: `// bass and drums loop
$: s("bd*4").bank("RolandTR909").gain(.85)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.6)
$: note("c2 c2 c2 c2")
  .s("sine").gain(.5).lpf(200)`,
      },
      {
        label: 'Guitar Loop',
        code: `// guitar riff loop
$: note("c3 e3 g3 c4 g3 e3")
  .s("gm_clean_guitar").velocity(.5)
  .room(.3)`,
      },
      {
        label: 'Rhodes Loop',
        code: `// rhodes chord loop
$: note("<[e3,g3,b3] [a3,c4,e4]>")
  .s("gm_epiano1").velocity(.35)
  .room(.4).slow(2)`,
      },
      {
        label: 'Minimal Loop',
        code: `// minimal techno loop
$: s("bd*4").gain(.8)
$: s("~ rim ~ ~").gain(.3)
$: s("hh*16").gain("[.15 .3]*8")`,
      },
      {
        label: 'Breakbeat Loop',
        code: `// breakbeat loop
$: s("[bd ~ bd ~] [~ bd ~ bd]").gain(.8)
$: s("[~ sd ~ ~] [~ ~ sd ~]").gain(.65)`,
      },
      {
        label: 'Dub Loop',
        code: `// dub reggae loop
$: s("bd ~ ~ bd ~ ~ bd ~").gain(.7)
$: s("~ ~ cp ~ ~ ~ ~ ~").gain(.5)
  .delay(.4).delayfeedback(.5)`,
      },
      {
        label: 'Triplet Loop',
        code: `// triplet feel loop
$: s("bd(3,12)").gain(.75)
$: s("sd(4,12,1)").gain(.55)
$: s("hh*12").gain("[.2 .3 .25]*4")`,
      },
      {
        label: 'Evolving Loop',
        code: `// slowly evolving loop
$: note("<c3 c3 e3 g3>")
  .s("sawtooth").gain(.35)
  .lpf(sine.range(400,2000).slow(16))
  .room(.3)`,
      },
      {
        label: 'Stack All',
        code: `// full stack loop
$: s("bd*4").gain(.8)
$: s("~ cp ~ ~").gain(.6)
$: s("[~ hh]*4").gain(.4)
$: note("<c2 f2 g2 b1>").s("sine").gain(.5).lpf(200)
$: note("<[c3,e3,g3]>").s("supersaw").gain(.25).lpf(1500)`,
      },
      {
        label: 'Chop Loop',
        code: `// chopped loop effect
$: note("c3 e3 g3 b3")
  .s("piano").gain(.5)
  .chop(4)`,
      },
      {
        label: 'Reverse Loop',
        code: `// reverse layer
$: s("chin:0 chin:1")
  .speed(-1).gain(.4)
  .room(.5).delay(.3).slow(2)`,
      },
      {
        label: 'Drone Loop',
        code: `// drone base loop
$: note("[c2,g2]").s("sawtooth")
  .gain(.2).lpf(400)
  .room(.7).roomsize(5)`,
      },
      {
        label: 'Glitch Loop',
        code: `// glitch pattern loop
$: s("bd").chop(16)
  .speed(perlin.range(.5,2))
  .gain(.5)`,
      },
      {
        label: 'Layer + Filter',
        code: `// loop with filter sweep
$: s("bd sd [~ bd] sd")
  .bank("RolandTR808").gain(.7)
$: note("c3*4").s("sawtooth")
  .gain(.3).lpf(sine.range(300,2000).slow(8))`,
      },
      {
        label: 'Complete Stack',
        code: `// complete loop stack
$: s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
$: s("[~ hh]*4").bank("RolandTR808").gain(.3)
$: note("<c2 a1 b1 g1>").s("sine").gain(.5).lpf(200).slow(2)
$: note("<[c3,e3,g3,b3] [a2,c3,e3,g3]>").s("piano").gain(.45).room(.4).slow(2)`,
      },
      {
        label: 'Minimal Loop Build',
        code: `// minimal loop building blocks
$: s("bd ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.55)
$: s("~ ~ sd ~ ~ ~ sd ~").bank("RolandTR808").gain(.45)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR808").gain(.25)
$: note("c2 ~ c2 ~ e2 ~ c2 ~").s("sine").gain(.4).lpf(100)`,
      },
      {
        label: 'Groove Layer Stack',
        code: `// layered groove stack
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.55)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)
$: note("c2 ~ e2 ~ f2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.5)
$: note("<[c3,e3,g3] [b2,d3,f3]>").s("gm_epiano1").velocity(.3).slow(2)`,
      },
      {
        label: 'Ambient Loop',
        code: `// ambient loop layers
$: note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [g3,b3,d3]>")
  .s("gm_warm_pad").velocity(.3).room(.7).slow(4)
$: note("c5 ~ e5 ~ g5 ~ ~ ~").s("gm_celesta").velocity(.2).delay(.3)
$: s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.3).room(.4)`,
      },
      {
        label: 'Funk Loop Kit',
        code: `// funk loop kit
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)
$: note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.55)
$: note("~ [e4,g4] ~ ~ ~ [f4,a4] ~ ~").s("gm_clean_guitar").velocity(.35)`,
      },
      {
        label: 'Techno Loop Stack',
        code: `// techno loop stack
$: s("bd bd bd bd").bank("RolandTR909").gain(.6)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.5)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)
$: note("c1 ~ c1 ~ ~ ~ c1 ~").s("sawtooth").lpf(300).gain(.45).shape(.3)`,
      },
      {
        label: 'Lo-Fi Loop Tape',
        code: `// lo-fi tape loop
$: note("c4 e4 g4 b4 g4 e4 c4 ~")
  .s("gm_epiano2").velocity(.35).lpf(2000).room(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
$: s("hh hh hh hh").bank("RolandTR808").gain(.2)
$: note("c2 ~ g2 ~ c2 ~ e2 ~").s("gm_acoustic_bass").velocity(.35)`,
      },
      {
        label: 'DnB Loop Build',
        code: `// drum and bass loop build
$: s("bd ~ sd ~ ~ bd sd ~, ~ ~ ~ bd ~ ~ sd ~")
  .bank("RolandTR909").gain(.55)
$: s("hh hh hh hh oh hh hh hh").bank("RolandTR909").gain(.3)
$: note("c2 ~ ~ c2 e2 ~ c2 ~").s("gm_synth_bass_1").velocity(.55)`,
      },
      {
        label: 'Jazz Loop Cycle',
        code: `// jazz loop cycle
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.4)
$: s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.25)
$: note("d2 a2 g2 d3 c2 g2 f2 c3").s("gm_acoustic_bass").velocity(.45)
$: note("<[d3,g3,a3,c4] [g3,b3,d4,f4] [c3,e3,g3,b3] [f3,a3,c4,e4]>")
  .s("gm_epiano1").velocity(.3).slow(2)`,
      },
      {
        label: 'Reggae Loop',
        code: `// reggae loop layers
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.5)
$: s("~ ~ rim ~ ~ ~ rim ~").bank("RolandTR808").gain(.3)
$: note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
$: note("~ [b3,d4,f4] ~ [b3,d4,f4] ~ [a3,c4,e4] ~ [a3,c4,e4]")
  .s("gm_muted_guitar").velocity(.35)`,
      },
      {
        label: 'House Loop Full',
        code: `// full house loop
$: s("bd bd bd bd").bank("RolandTR909").gain(.55)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.45)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR909").gain(.3)
$: note("c2 ~ c2 ~ e2 ~ c2 ~").s("gm_synth_bass_2").velocity(.5)
$: note("<[c3,e3,g3]>").s("gm_epiano2").velocity(.25).slow(4)`,
      },
      {
        label: 'Latin Loop Stack',
        code: `// latin loop stack
$: s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)
$: note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.5)
$: note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_trumpet").velocity(.35).room(.3)`,
      },
      {
        label: 'R&B Loop Smooth',
        code: `// smooth R&B loop
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.25)
$: note("c2 ~ e2 ~ f2 ~ e2 ~").s("gm_electric_bass_finger").velocity(.45)
$: note("<[c4,e4,g4,b4] [f3,a3,c4,e4]>")
  .s("gm_epiano2").velocity(.3).room(.35).slow(2)`,
      },
      {
        label: 'Cinematic Loop',
        code: `// cinematic loop layers
$: note("<[c3,g3,c4] [a2,e3,a3] [b2,f3,b3] [g2,d3,g3]>")
  .s("gm_strings1").velocity(.4).room(.6).slow(4)
$: s("~ ~ ~ ~ bd ~ ~ ~").bank("RolandTR808").gain(.4).room(.4)
$: note("c5 ~ e5 ~ g5 ~ ~ ~").s("gm_flute").velocity(.25).room(.5)
$: note("c2 ~ ~ ~ a1 ~ ~ ~").s("gm_contrabass").velocity(.35).slow(2)`,
      },
      {
        label: 'Trap Loop Kit',
        code: `// trap loop kit
$: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808").gain(.55)
$: s("~ ~ ~ ~ sd ~ ~ ~").bank("RolandTR808").gain(.5)
$: s("hh hh hh hh oh hh [hh hh] hh").bank("RolandTR808").gain(.3)
$: note("c1 ~ ~ ~ ~ ~ c1 ~").s("sine").gain(.55).shape(.3).lpf(80)`,
      },
      {
        label: 'Gospel Loop',
        code: `// gospel loop stack
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.45)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.4)
$: note("[c3,e3,g3,c4] ~ [d3,f3,a3,d4] ~ [e3,g3,b3,e4] ~ [c3,e3,g3,c4] ~")
  .s("gm_church_organ").velocity(.4).room(.5).slow(2)
$: note("c2 d2 e2 c2 d2 e2 g2 c2").s("gm_acoustic_bass").velocity(.4)`,
      },
      {
        label: 'Garage Loop',
        code: `// 2-step garage loop
$: s("bd ~ ~ bd sd ~ ~ ~").bank("RolandTR808").gain(.5)
$: s("~ hh ~ hh ~ oh ~ hh").bank("RolandTR808").gain(.3)
$: note("c2 ~ ~ c2 ~ ~ e2 ~").s("gm_synth_bass_1").velocity(.5)
$: note("<[c3,e3,g3]>").s("gm_voice_oohs").velocity(.2).room(.4).slow(4)`,
      },
      {
        label: 'Afro Loop Stack',
        code: `// afrobeat loop stack
$: s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)
$: note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_electric_bass_finger").velocity(.5)
$: note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_trumpet").velocity(.3).room(.3)`,
      },
      {
        label: 'Synthwave Loop',
        code: `// synthwave loop full
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.5)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.25)
$: note("c2 ~ c2 ~ g1 ~ c2 ~").s("gm_synth_bass_2").velocity(.5)
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("sawtooth").lpf(2000).gain(.2).room(.35).slow(2)`,
      },
      {
        label: 'Progressive Loop',
        code: `// progressive build loop
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR909").gain(.3)
$: note("c2 ~ c2 ~ e2 ~ f2 ~").s("gm_synth_bass_1").velocity(.5)
$: note("<[c4,e4,g4] [b3,d4,f4] [a3,c4,e4] [b3,d4,f4]>")
  .s("gm_warm_pad").velocity(.3).room(.5).slow(4)
$: note("c5 e5 g5 ~ ~ ~ ~ ~").s("gm_saw_lead").gain(.15).delay(.2)`,
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
$: note("<[c2,g2,c3] [a1,e2,a2]>")
  .s("gm_choir_aahs").velocity(.4)
  .lpf(800).room(.6).slow(4)`,
      },
      {
        label: 'Low Hum',
        code: `// low humming bass tone
$: note("<c2 d2 e2 d2>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(500).room(.5).slow(2)`,
      },
      {
        label: 'Baritone Melody',
        code: `// baritone singing line
$: note("c3 d3 e3 f3 g3 f3 e3 d3")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4)`,
      },
      {
        label: 'Drone Bass Voice',
        code: `// droning bass vocal
$: note("[c2,g2]")
  .s("gm_choir_aahs").velocity(.35)
  .room(.7).roomsize(5)
  .lpf(600)`,
      },
      {
        label: 'Chant Low',
        code: `// low chant pattern
$: note("c2 ~ e2 ~ g2 ~ e2 ~")
  .s("gm_choir_aahs").velocity(.35)
  .lpf(700).room(.5).slow(2)`,
      },
      {
        label: 'Tenor Harmony',
        code: `// tenor vocal harmony
$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("gm_choir_aahs").velocity(.4)
  .room(.4).slow(2)`,
      },
      {
        label: 'Male Reverb Wash',
        code: `// male vocal reverb wash
$: note("<[c2,g2,c3]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.9).roomsize(8).slow(4)`,
      },
      {
        label: 'Deep Echo',
        code: `// deep male vocal echo
$: note("c2 ~ ~ e2 ~ ~ g2 ~")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.5).delayfeedback(.6)
  .room(.5).slow(2)`,
      },
      {
        label: 'Male Vowel',
        code: `// male vowel morph
$: note("c3*4").s("sawtooth")
  .gain(.3).vowel("<a e i o>")
  .lpf(1200)`,
      },
      {
        label: 'Low Pad',
        code: `// low male pad
$: note("<[c2,e2,g2] [a1,c2,e2]>")
  .s("gm_choir_aahs").velocity(.3)
  .room(.6).slow(4)`,
      },
      {
        label: 'Bass Swell',
        code: `// bass vocal swell
$: note("<[c2,g2]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.1,.4).slow(4))
  .room(.6).slow(4)`,
      },
      {
        label: 'Male Staccato',
        code: `// staccato male voice
$: note("c3 ~ c3 ~ e3 ~ c3 ~")
  .s("gm_choir_aahs").velocity(.4)
  .decay(.15).lpf(1000)`,
      },
      {
        label: 'Deep Harmony Stack',
        code: `// stacked deep harmony
$: note("<[c2,g2,c3] [b1,f2,b2]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.5).slow(2)`,
      },
      {
        label: 'Male Delayed',
        code: `// delayed male vocal
$: note("c2 ~ ~ ~ e2 ~ ~ ~")
  .s("gm_choir_aahs").velocity(.35)
  .delay(.6).delayfeedback(.65)
  .room(.4)`,
      },
      {
        label: 'Gregorian Chant',
        code: `// gregorian chant style
$: note("c3 d3 c3 b2 c3 d3 e3 d3")
  .s("gm_choir_aahs").velocity(.35)
  .room(.8).roomsize(6).slow(2)`,
      },
      {
        label: 'Male Octaves',
        code: `// male octave drone
$: note("[c2,c3]")
  .s("gm_choir_aahs").velocity(.35)
  .room(.6).roomsize(4)`,
      },
      {
        label: 'Numbers Count',
        code: `// numbers vocal beat
$: s("numbers:0 numbers:1 numbers:2 numbers:3")
  .gain(.5).speed(1.1)`,
      },
      {
        label: 'East Chant Male',
        code: `// eastern male chant
$: s("east:0 east:2 east:3 east:6")
  .gain(.5).room(.4).slow(2)`,
      },
      {
        label: 'Chin Chop',
        code: `// chin vocal chop
$: s("chin:0 chin:2 chin:1 chin:3")
  .gain(.5).room(.3)`,
      },
      {
        label: 'Low Filtered Voice',
        code: `// filtered low voice
$: note("<c2 d2 e2 c2>")
  .s("gm_choir_aahs").velocity(.3)
  .lpf(sine.range(300,800).slow(4))
  .room(.5).slow(2)`,
      },
      {
        label: 'Male Whisper',
        code: `// whisper-like texture
$: s("breath:0 ~ breath:1 ~")
  .gain(.3).lpf(1500)
  .room(.6).roomsize(4).slow(2)`,
      },
      {
        label: 'Deep Sustain',
        code: `// deep sustained voice
$: note("c2").s("gm_choir_aahs")
  .velocity(.35).room(.7).roomsize(5)`,
      },
      {
        label: 'Male Chopped',
        code: `// chopped male choir
$: note("[c2,g2,c3]")
  .s("gm_choir_aahs").velocity(.35)
  .chop(8).room(.3)`,
      },
      {
        label: 'Crushed Voice',
        code: `// crushed male vocal
$: s("chin:0 chin:2").gain(.5)
  .crush(8).room(.3).slow(2)`,
      },
      {
        label: 'Low Reverb Hits',
        code: `// reverb male hits
$: note("c2 ~ ~ ~ g2 ~ ~ ~")
  .s("gm_choir_aahs").velocity(.4)
  .room(.85).roomsize(7)`,
      },
      {
        label: 'Male Pulse',
        code: `// pulsing male voice
$: note("c2*4").s("gm_choir_aahs")
  .velocity("[.15 .35 .25 .4]")
  .room(.4)`,
      },
      {
        label: 'Baritone Pad',
        code: `// baritone pad wash
$: note("<[c2,e2,g2,b2]>")
  .s("gm_choir_aahs").velocity(.3)
  .room(.7).roomsize(5).slow(4)`,
      },
      {
        label: 'Male + Beat',
        code: `// male choir over beat
$: s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
$: s("[~ hh]*4").bank("RolandTR808").gain(.3)
$: note("<[c2,g2,c3]>").s("gm_choir_aahs")
  .velocity(.3).room(.4).slow(2)`,
      },
      {
        label: 'Deep Swell',
        code: `// deep male swell
$: note("<[c2,g2]>")
  .s("gm_choir_aahs")
  .velocity(sine.range(.1,.45).slow(8))
  .room(.7).roomsize(5)`,
      },
      {
        label: 'Male Harmony Full',
        code: `// full male harmony
$: note("<[c2,e2,g2] [a1,c2,e2] [f1,a1,c2] [g1,b1,d2]>")
  .s("gm_choir_aahs").velocity(.35)
  .room(.5).slow(2)`,
      },
      {
        label: 'Male R&B Smooth',
        code: `// male R&B smooth — "Velvet Nights"
// Velvet nights and city lights that fade
// Every word a promise that we made
// Shadows dance across the bedroom wall
// Whispered love before the curtains fall
// Hold me close through winter spring and all
$: note("c3 d3 e3 g3 f3 e3 d3 c3").s("gm_choir_aahs")
  .velocity(sine.range(.3,.55).slow(8)).room(.5)
$: note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.25).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Male Hip-Hop Deep',
        code: `// male hip-hop vocal — "Concrete Crown"
// Concrete crown upon a weary head
// Every verse is blood and tears I shed
// Streets remember every name I spoke
// Rising from the ashes and the smoke
// Legacy of fire never broke
$: note("c2 c2 e2 f2 e2 c2 ~ c2").s("gm_choir_aahs")
  .velocity(.5).room(.3)
$: note("c1 ~ c1 ~ e1 ~ f1 ~").s("gm_synth_bass_1").velocity(.6)
$: s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.55)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Male Jazz Croon',
        code: `// male jazz croon — "Midnight Club"
// Midnight club where saxophones confide
// Bourbon neat and music is the guide
// Velvet voice that floats above the crowd
// Singing soft but meaning something loud
// In this room the lonely ones are proud
$: note("g2 a2 b2 d3 c3 b2 a2 g2").s("gm_choir_aahs")
  .velocity(.4).room(.5).delay(.15)
$: note("g2 d3 c3 g2 f2 c3 b2 g2").s("gm_acoustic_bass").velocity(.45)
$: s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Male Gospel Lead',
        code: `// male gospel lead — "Higher Ground"
// Higher ground is calling out my name
// Through the fire walking through the flame
// Every trial only makes me strong
// Singing praise the whole day long
// Grace will carry us where we belong
$: note("c3 e3 f3 g3 a3 g3 f3 e3").s("gm_choir_aahs")
  .velocity(.6).room(.6)
$: note("[c3,e3,g3] ~ [f3,a3,c4] ~ [g3,b3,d4] ~ [c3,e3,g3] ~")
  .s("gm_church_organ").velocity(.35).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.35)`,
      },
      {
        label: 'Male Blues Growl',
        code: `// male blues growl — "Rusty Rails"
// Rusty rails and whiskey stained goodbyes
// Mornin' sun just burnin' through my eyes
// Woman gone and took the car and dog
// Sittin' here just sinkin' in the fog
// Blues keep rollin' like a hollow log
$: note("e2 g2 a2 b2 a2 g2 e2 ~").s("gm_choir_aahs")
  .velocity(sine.range(.35,.6).slow(6)).room(.4)
$: note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.35)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Male Reggae Chant',
        code: `// male reggae chant — "Island Roots"
// Island roots are deeper than the sea
// Jah provide the way for you and me
// Babylon can never break the chain
// Music wash away the hurt and pain
// Rise again like sunshine after rain
$: note("g2 b2 c3 d3 c3 b2 g2 ~").s("gm_choir_aahs")
  .velocity(.45).room(.5).delay(.2)
$: note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'Male Rock Anthem',
        code: `// male rock anthem — "Iron Will"
// Iron will and thunder in my chest
// Every scar a badge upon my vest
// Stadium is roaring feel the sound
// Feet are pounding shake the frozen ground
// We are legends and we won't be bound
$: note("e2 e2 g2 a2 b2 a2 g2 e2").s("gm_choir_aahs")
  .velocity(.6).room(.35)
$: note("[e2,b2,e3] ~ [a2,e3,a3] ~ [d2,a2,d3] ~ [e2,b2,e3] ~")
  .s("gm_overdriven_guitar").velocity(.45).slow(2)
$: note("e1 ~ e1 ~ a1 ~ b1 ~").s("gm_electric_bass_pick").velocity(.5)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR909").gain(.5)`,
      },
      {
        label: 'Male Folk Tender',
        code: `// male folk tender — "Timber Creek"
// Timber creek where fireflies ignite
// Banjo strings are humming through the night
// Mama sang a lullaby so sweet
// Daddy tapped his worn out muddy feet
// Simple life that nothing can defeat
$: note("g2 a2 b2 d3 b2 a2 g2 g2").s("gm_choir_aahs")
  .velocity(.4).room(.45)
$: note("g2 b2 d3 g3 d3 b2 g2 b2").s("gm_banjo").velocity(.35)
$: note("g2 ~ d2 ~ g2 ~ d2 ~").s("gm_acoustic_bass").velocity(.4)`,
      },
      {
        label: 'Male Soul Falsetto',
        code: `// male soul falsetto — "Purple Sky"
// Purple sky is bleeding into gold
// Stories that the universe has told
// Reaching for the notes that heal the soul
// Falsetto makes the broken pieces whole
// Love is all that fills this empty bowl
$: note("c3 e3 g3 c4 g3 e3 c3 ~").s("gm_voice_oohs")
  .velocity(sine.range(.25,.5).slow(8)).room(.5)
$: note("[c3,e3,g3,b3] ~ [f2,a2,c3] ~")
  .s("gm_epiano1").velocity(.25).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Male Country Road',
        code: `// male country vocal — "Back Roads"
// Back roads and a pickup full of hay
// Radio is playin' yesterday
// Dust cloud rising like a golden veil
// Front porch stories over ginger ale
// Sundown singin' down the cotton trail
$: note("e2 g2 g2 a2 g2 g2 e2 d2").s("gm_choir_aahs")
  .velocity(.45).room(.4)
$: note("e2 a2 b2 e2 a2 b2 e2 a2").s("gm_steel_guitar").velocity(.3)
$: note("e2 ~ a1 ~ b1 ~ e2 ~").s("gm_acoustic_bass").velocity(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Male Opera Bass',
        code: `// male opera bass — "Cathedral Dawn"
// Cathedral dawn with voices carved in stone
// A single note that shakes the very bone
// The choir swells through arches high and wide
// Echoes from the altar deep inside
// Majesty that never can be denied
$: note("c2 ~ d2 ~ e2 ~ c2 ~").s("gm_choir_aahs")
  .velocity(.5).room(.8).roomsize(8).slow(2)
$: note("[c2,g2,c3] ~ [d2,a2,d3] ~ [e2,b2,e3] ~ [c2,g2,c3] ~")
  .s("gm_choir_aahs").velocity(.3).room(.75).slow(2)`,
      },
      {
        label: 'Male Dancehall',
        code: `// male dancehall vocal — "Riddim King"
// Riddim king upon the mic tonight
// Every word I spit ignite the light
// Crowd a rock from left side to the right
// Sound system a shake with all its might
// Dancehall general ready for the fight
$: note("d2 f2 g2 a2 g2 f2 d2 ~").s("gm_choir_aahs")
  .velocity(.5).room(.3)
$: note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.55)
$: s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.5)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Male Afro Spirit',
        code: `// male afro spiritual — "Drum Circle"
// Drum circle beating like a heart
// Ancient rhythms since the very start
// Voices rise above the desert sand
// Unity connected hand to hand
// Music is the language of the land
$: note("d2 f2 g2 a2 g2 f2 d2 c2").s("gm_choir_aahs")
  .velocity(.5).room(.4).delay(.15)
$: note("d1 ~ d1 ~ f1 ~ g1 ~").s("gm_synth_bass_1").velocity(.5)
$: s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Male Pop Bright',
        code: `// male pop hook — "Electric Sky"
// Electric sky is brighter than the sun
// Dancing like tomorrow never comes
// Every heartbeat synced up to the bass
// Neon running down my smiling face
// This is our forever time and place
$: note("c3 d3 e3 g3 e3 d3 c3 ~").s("gm_choir_aahs")
  .velocity(.5).room(.35)
$: note("[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]")
  .s("gm_bright_piano").velocity(.3).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.45)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.2)`,
      },
      {
        label: 'Male Latin Bolero',
        code: `// male latin bolero — "Rosa Eterna"
// Rosa eterna floreciendo al sol
// Cada nota llena de dolor
// Canto bajo la luna brillar
// El corazon empieza a recordar
// Musica que nunca va a parar
$: note("a2 b2 c3 d3 c3 a2 g2 a2").s("gm_choir_aahs")
  .velocity(.45).room(.45).delay(.1)
$: note("a1 ~ c2 ~ d2 ~ e2 ~").s("gm_acoustic_bass").velocity(.45)
$: note("[a2,c3,e3] ~ [d3,f3,a3] ~ [e3,g3,b3] ~ [a2,c3,e3] ~")
  .s("gm_nylon_guitar").velocity(.3).slow(2)`,
      },
      {
        label: 'Male Trap Melodic',
        code: `// male trap melodic — "Midnight Drive"
// Midnight drive the city open wide
// Every demon riding by my side
// Money talk but silence golden still
// Grinding hard on top of every hill
// Made it out by nothing but my will
$: note("c2 ~ e2 ~ f2 e2 c2 ~").s("gm_synth_voice")
  .velocity(.5).room(.25).delay(.1)
$: note("c1 ~ c1 ~ e1 ~ c1 ~").s("sine").gain(.5).lpf(80).shape(.3)
$: s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.55)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Male Indie Warm',
        code: `// male indie warm — "Paper Boats"
// Paper boats upon a puddle stream
// Chasing down the edges of a dream
// Afternoon with nothing left to prove
// Awkward hearts that find a gentle groove
// Every little gesture says I love you
$: note("e2 g2 a2 b2 a2 g2 e2 d2").s("gm_choir_aahs")
  .velocity(.4).room(.4)
$: note("e2 b2 e3 b2 a2 e3 a2 e2").s("gm_clean_guitar").velocity(.3)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Male EDM Anthem',
        code: `// male EDM anthem — "Rise Together"
// Rise together higher than before
// Feel the bass line shaking through the floor
// Hands up everybody lose control
// Music is the fire in my soul
// We are one and that's the only goal
$: note("[c2,e2,g2] ~ [a1,c2,e2] ~ [f1,a1,c2] ~ [g1,b1,d2] ~")
  .s("gm_choir_aahs").velocity(.55).room(.4).slow(2)
$: note("c1 ~ c1 ~ a0 ~ g0 ~").s("sawtooth").lpf(300).gain(.4).shape(.3)
$: s("bd bd bd bd").bank("RolandTR909").gain(.55)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.45)`,
      },
      {
        label: 'Male Lofi Whisper',
        code: `// male lofi whisper — "Quiet Hours"
// Quiet hours when the world stands still
// Coffee steam ascending from the sill
// Vinyl crackle memories unfold
// Every gentle note a tale retold
// Warmth inside when everything is cold
$: note("c3 e3 g3 b3 g3 e3 c3 ~").s("gm_choir_aahs")
  .velocity(sine.range(.2,.4).slow(8)).room(.45).lpf(1500)
$: note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.2).room(.35).lpf(2000).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
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
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.5).slow(4)`,
      },
      {
        label: 'Soprano Melody',
        code: `// soprano singing
$: note("e4 g4 a4 b4 a4 g4 e4 d4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.4)`,
      },
      {
        label: 'High Hum',
        code: `// high female humming
$: note("<c4 d4 e4 d4>")
  .s("gm_voice_oohs").velocity(.35)
  .lpf(3000).room(.5).slow(2)`,
      },
      {
        label: 'Soprano Harmony',
        code: `// soprano harmony stack
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.4)
  .room(.4).slow(2)`,
      },
      {
        label: 'Ethereal Voice',
        code: `// ethereal female voice
$: note("<[c4,g4,c5]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.85).roomsize(7).slow(4)`,
      },
      {
        label: 'Synth Voice',
        code: `// synthetic female voice
$: note("c4 e4 g4 b4 c5 b4 g4 e4")
  .s("gm_synth_voice").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Delayed Oohs',
        code: `// delayed oohs
$: note("c4 ~ e4 ~ g4 ~ c5 ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.5).delayfeedback(.55)
  .room(.4)`,
      },
      {
        label: 'Female Chop',
        code: `// female vocal chop
$: s("chin:0 ~ chin:1 ~")
  .speed(1.5).gain(.5)
  .room(.3)`,
      },
      {
        label: 'High Pad',
        code: `// high female pad
$: note("<[c4,e4,g4,b4] [a3,c4,e4,g4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.6).slow(4)`,
      },
      {
        label: 'Soprano Swell',
        code: `// soprano vocal swell
$: note("<[c4,g4]>")
  .s("gm_voice_oohs")
  .velocity(sine.range(.1,.45).slow(4))
  .room(.6).slow(4)`,
      },
      {
        label: 'Bright Melody',
        code: `// bright soprano melody
$: note("g4 a4 b4 d5 c5 b4 g4 a4")
  .s("gm_voice_oohs").velocity(.45)
  .room(.3)`,
      },
      {
        label: 'Whisper Float',
        code: `// whisper floating
$: s("breath:0 ~ breath:2 ~")
  .gain(.3).room(.7).roomsize(5)
  .lpf(4000).slow(2)`,
      },
      {
        label: 'Female Reverb',
        code: `// female reverb cathedral
$: note("<[c4,e4,g4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.9).roomsize(8).slow(4)`,
      },
      {
        label: 'Descending Line',
        code: `// descending vocal line
$: note("c5 b4 g4 f4 e4 d4 c4 e4")
  .s("gm_voice_oohs").velocity(.4)
  .room(.4)`,
      },
      {
        label: 'Female Echo',
        code: `// echoing female voice
$: note("c4 ~ ~ ~ e4 ~ ~ ~")
  .s("gm_voice_oohs").velocity(.35)
  .delay(.6).delayfeedback(.6)
  .room(.5)`,
      },
      {
        label: 'Staccato Ooh',
        code: `// staccato oohs
$: note("c4 ~ c4 ~ e4 ~ c4 ~")
  .s("gm_voice_oohs").velocity(.4)
  .decay(.12)`,
      },
      {
        label: 'Female Drone',
        code: `// droning female vocal
$: note("[c4,g4]")
  .s("gm_voice_oohs").velocity(.3)
  .room(.7).roomsize(5)`,
      },
      {
        label: 'Shimmer Voice',
        code: `// shimmering female
$: note("<[c4,e4,g4,b4]>")
  .s("gm_voice_oohs").velocity(.3)
  .delay(.4).delayfeedback(.55)
  .room(.6).slow(4)`,
      },
      {
        label: 'Female Chopped',
        code: `// chopped female choir
$: note("[c4,e4,g4]")
  .s("gm_voice_oohs").velocity(.35)
  .chop(8).room(.3)`,
      },
      {
        label: 'Angelic Pad',
        code: `// angelic pad wash
$: note("<[c4,g4,c5] [a3,e4,a4]>")
  .s("gm_voice_oohs").velocity(.3)
  .room(.8).roomsize(6).slow(4)`,
      },
      {
        label: 'High Stutter',
        code: `// stuttered high voice
$: s("chin:1").chop(16)
  .speed(1.5).gain(.5)
  .room(.3)`,
      },
      {
        label: 'Vowel Morph',
        code: `// female vowel morph
$: note("c4*4").s("sawtooth")
  .gain(.3).vowel("<a e i o u>")
  .lpf(4000)`,
      },
      {
        label: 'Crystal Voice',
        code: `// crystal clear vocal
$: note("c5 e5 g5 c6")
  .s("gm_voice_oohs").velocity(.35)
  .room(.6).delay(.2).slow(2)`,
      },
      {
        label: 'Female Vibrato',
        code: `// vibrato vocal
$: note("c4").s("gm_voice_oohs")
  .velocity(.4)
  .vibmod(.1).vibdepth(2)
  .room(.5)`,
      },
      {
        label: 'Lullaby',
        code: `// lullaby melody
$: note("c4 d4 e4 g4 e4 d4 c4 d4")
  .s("gm_voice_oohs").velocity(.35)
  .room(.5).delay(.2).slow(2)`,
      },
      {
        label: 'Female Crushed',
        code: `// crushed female voice
$: note("c4 e4 g4 c5")
  .s("gm_voice_oohs").velocity(.4)
  .crush(10).room(.3)`,
      },
      {
        label: 'Pitched Breath',
        code: `// pitched breathy vocal
$: s("breath:0 breath:1 breath:2 breath:0")
  .speed("<1 1.5 .75 1.25>")
  .gain(.35).room(.5).slow(2)`,
      },
      {
        label: 'Glissando',
        code: `// vocal glissando
$: note("c4 d4 e4 f4 g4 a4 b4 c5")
  .s("gm_voice_oohs").velocity(.4)
  .glide(.1).room(.4)`,
      },
      {
        label: 'Female + Beat',
        code: `// female vocal over beat
$: s("bd sd:2 [~ bd] sd").bank("RolandTR808").gain(.75)
$: s("[~ hh]*4").bank("RolandTR808").gain(.3)
$: note("<[c4,e4,g4] [a3,c4,e4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.4).slow(2)`,
      },
      {
        label: 'Full Female Harmony',
        code: `// full female harmony
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_voice_oohs").velocity(.35)
  .room(.5).slow(2)
$: note("<[c5,e5,g5]>")
  .s("gm_voice_oohs").velocity(.2)
  .room(.6).slow(4)`,
      },
      {
        label: 'Female R&B Silk',
        code: `// female R&B silk — "Satin Dreams"
// Satin dreams are falling through my hands
// Moonlit whispers only love understands
// Touch me like the ocean meets the shore
// Every breath is begging you for more
// Open up the window close the door
$: note("c5 d5 e5 g5 f5 e5 d5 c5").s("gm_voice_oohs")
  .velocity(sine.range(.3,.55).slow(8)).room(.5).delay(.12)
$: note("[c3,e3,g3,b3] ~ [f2,a2,c3,e3] ~")
  .s("gm_epiano2").velocity(.25).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Female Pop Soar',
        code: `// female pop soar — "Crystal Wings"
// Crystal wings are carrying me high
// Every star a diamond in the sky
// Singing loud until the echoes fade
// Brave enough to stand inside the rain
// I was born to fly and not afraid
$: note("e5 d5 c5 b4 c5 d5 e5 ~").s("gm_voice_oohs")
  .velocity(.55).room(.4).delay(.1)
$: note("[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]")
  .s("gm_bright_piano").velocity(.3).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR909").gain(.45)
$: s("hh hh hh hh hh hh hh hh").bank("RolandTR909").gain(.2)`,
      },
      {
        label: 'Female Jazz Velvet',
        code: `// female jazz velvet — "Candlelit Room"
// Candlelit room where the shadows play
// Swinging soft through notes of cabernet
// Fingers trace the rim of crystal glass
// Every moment hoping this will last
// Melody as smooth as polished brass
$: note("g4 a4 b4 d5 c5 b4 a4 g4").s("gm_voice_oohs")
  .velocity(.45).room(.5).delay(.18)
$: note("g2 d3 c3 g2 f2 c3 b2 g2").s("gm_acoustic_bass").velocity(.45)
$: s("~ hh ~ hh ~ hh ~ hh").bank("RolandTR808").gain(.2)`,
      },
      {
        label: 'Female Gospel Fire',
        code: `// female gospel fire — "Holy Water"
// Holy water runnin' through my veins
// Break the shackles loose from all the chains
// Lift your hands and let the spirit move
// Nothing in this world we got to prove
// Heaven opens up from every groove
$: note("c5 e5 f5 g5 a5 g5 f5 e5").s("gm_voice_oohs")
  .velocity(.6).room(.6)
$: note("[c4,e4,g4] ~ [f4,a4,c5] ~ [g4,b4,d5] ~ [c4,e4,g4] ~")
  .s("gm_church_organ").velocity(.35).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.4)
$: s("~ cp ~ cp").bank("RolandTR909").gain(.35)`,
      },
      {
        label: 'Female Soul Deep',
        code: `// female soul deep — "Golden Hour"
// Golden hour painting everything so warm
// Shelter me from every passing storm
// Sing until the tears become a song
// Holding on when everything goes wrong
// Baby I have loved you all along
$: note("c4 e4 f4 g4 f4 e4 c4 ~").s("gm_voice_oohs")
  .velocity(sine.range(.35,.6).slow(6)).room(.45)
$: note("[c3,e3,g3] ~ [a2,c3,e3] ~ [b2,d3,f3] ~ [c3,e3,g3] ~")
  .s("gm_epiano1").velocity(.25).slow(2)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Female Indie Dream',
        code: `// female indie dream — "Paper Kites"
// Paper kites above the rooftop line
// Tangled up in yours and tangled up in mine
// Coffee rings on yesterday's gazette
// Dancing to a song we can't forget
// This is close to beautiful as it gets
$: note("e4 g4 a4 b4 a4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.45).room(.4).delay(.15)
$: note("e3 b3 e4 b3 a3 e4 a3 e3").s("gm_clean_guitar").velocity(.3)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Female Country Heart',
        code: `// female country heart — "Wildflower Road"
// Wildflower road beneath a painted sky
// Pickup truck and time is drifting by
// Sang along to every song we knew
// Summer fading into autumn blue
// Darlin I keep coming back to you
$: note("e4 g4 g4 a4 g4 g4 e4 d4").s("gm_voice_oohs")
  .velocity(.45).room(.4)
$: note("e3 a3 b3 e3 a3 b3 e3 a3").s("gm_steel_guitar").velocity(.3)
$: note("e2 ~ a1 ~ b1 ~ e2 ~").s("gm_acoustic_bass").velocity(.4)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Female Reggae Queen',
        code: `// female reggae queen — "Island Breeze"
// Island breeze is blowin' through my hair
// Music floatin' salty in the air
// Dancin' barefoot in the moonlit sand
// Every riddim makes me understand
// Love is all we need across the land
$: note("g4 b4 c5 d5 c5 b4 g4 ~").s("gm_voice_oohs")
  .velocity(.45).room(.5).delay(.2)
$: note("~ g2 ~ g2 ~ b2 ~ c3").s("gm_electric_bass_finger").velocity(.5)
$: s("bd ~ ~ bd ~ sd ~ ~").bank("RolandTR808").gain(.45)`,
      },
      {
        label: 'Female Blues Ache',
        code: `// female blues ache — "Broken Mirror"
// Broken mirror seven years of rain
// Lipstick traces on the windowpane
// Sang my heart out on a corner stage
// Ink is bleeding through the final page
// Blues don't care about a woman's age
$: note("e4 g4 a4 b4 a4 g4 e4 ~").s("gm_voice_oohs")
  .velocity(sine.range(.35,.6).slow(6)).room(.45)
$: note("e2 a2 b2 e2 g2 a2 b2 e2").s("gm_clean_guitar").velocity(.35)
$: s("bd ~ sd ~ bd ~ sd ~").bank("RolandTR808").gain(.35)`,
      },
      {
        label: 'Female Afro Glow',
        code: `// female afro glow — "Golden Dust"
// Golden dust is spinning in the light
// Dancing through the fire every night
// Drums are speaking truth from long ago
// Every step a river every step a flow
// Voices of the ancestors below
$: note("d5 f5 g5 a5 g5 f5 d5 c5").s("gm_voice_oohs")
  .velocity(.5).room(.4).delay(.15)
$: note("d2 ~ d2 f2 g2 ~ d2 ~").s("gm_synth_bass_1").velocity(.55)
$: s("bd ~ bd ~ sd ~ bd sd").bank("RolandTR808").gain(.5)
$: s("hh oh hh hh oh hh hh oh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Female Latin Flame',
        code: `// female latin flame — "Luna Roja"
// Luna roja bailando en la noche
// Fuego crece con cada reproche
// Canto libre bajo cielo abierto
// Cada nota vuelve lo que es cierto
// El amor es siempre un puerto
$: note("a4 b4 c5 d5 c5 a4 g4 a4").s("gm_voice_oohs")
  .velocity(.5).room(.35).delay(.1)
$: note("a2 ~ c3 ~ d3 ~ e3 ~").s("gm_acoustic_bass").velocity(.5)
$: s("bd ~ ~ bd ~ bd ~ sd").bank("RolandTR808").gain(.45)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Female Dance Diva',
        code: `// female dance diva — "Strobe Light"
// Strobe light flashing on the dancing floor
// Give me bass and then give me some more
// Hands are waving high above the crowd
// DJ spin it louder make it loud
// Every beat a heartbeat I am proud
$: note("[c4,e4,g4] ~ [a3,c4,e4] ~ [f3,a3,c4] ~ [g3,b3,d4] ~")
  .s("gm_synth_choir").velocity(.5).room(.35).slow(2)
$: note("c2 ~ c2 ~ a1 ~ g1 ~").s("sawtooth").lpf(400).gain(.4).shape(.25)
$: s("bd bd bd bd").bank("RolandTR909").gain(.55)
$: s("~ cp ~ ~").bank("RolandTR909").gain(.45)`,
      },
      {
        label: 'Female Lullaby Soft',
        code: `// female lullaby soft — "Moonbeam"
// Moonbeam falling gentle on your face
// Wrapped in stardust floating into space
// Close your eyes the night will hold you tight
// Dream of everything that feels so right
// I will sing you into morning light
$: note("c5 b4 a4 g4 a4 g4 f4 e4").s("gm_voice_oohs")
  .velocity(sine.range(.2,.4).slow(8)).room(.55).slow(2)
$: note("<[c4,e4,g4] [a3,c4,e4] [f3,a3,c4] [g3,b3,d4]>")
  .s("gm_music_box").velocity(.2).slow(4)`,
      },
      {
        label: 'Female Funk Sassy',
        code: `// female funk sassy — "Hot Sauce"
// Hot sauce on the rhythm watch it burn
// Every single head is gonna turn
// Slap that bass and hit the one real hard
// Strutting through the club like a queen of cards
// Funky diva never dropping guard
$: note("c4 ~ e4 f4 ~ e4 c4 ~").s("gm_voice_oohs")
  .velocity(.55).room(.3)
$: note("c2 ~ c2 e2 f2 ~ c2 ~").s("gm_slap_bass_1").velocity(.55)
$: s("bd ~ sd ~ bd bd sd ~").bank("RolandTR808").gain(.5)
$: note("~ [e5,g5] ~ ~ ~ [f5,a5] ~ ~").s("gm_brass1").velocity(.35)`,
      },
      {
        label: 'Female Opera Aria',
        code: `// female opera aria — "Starlight Opera"
// Starlight opera echoing through halls
// Crystal chandeliers and marble walls
// Every phrase a painting in the air
// Beauty woven through a golden prayer
// Let the music take away all care
$: note("c5 ~ d5 ~ e5 ~ c5 ~").s("gm_voice_oohs")
  .velocity(.5).room(.8).roomsize(7).slow(2)
$: note("[c4,g4,c5] ~ [d4,a4,d5] ~ [e4,b4,e5] ~ [c4,g4,c5] ~")
  .s("gm_strings1").velocity(.3).room(.7).slow(2)`,
      },
      {
        label: 'Female Hip-Hop Hook',
        code: `// female hip-hop hook — "Crown Royal"
// Crown royal sitting on my throne
// Built this empire from the ground alone
// Every bar I spit is platinum laced
// Haters running but they can't keep pace
// Queen of every stage that I have graced
$: note("c4 c4 e4 f4 e4 c4 ~ c4").s("gm_voice_oohs")
  .velocity(.5).room(.25)
$: note("c1 ~ c1 ~ e1 ~ f1 ~").s("gm_synth_bass_1").velocity(.55)
$: s("bd ~ ~ bd sd ~ bd sd").bank("RolandTR808").gain(.5)
$: s("hh hh oh hh hh hh oh hh").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Female Ambient Glow',
        code: `// female ambient glow — "Cloud Garden"
// Cloud garden floating over silver streams
// Weaving melodies between my dreams
// Echo of a voice beyond the hill
// Time is frozen and the world is still
// Singing softly because silence fills
$: note("<c5 d5 e5 f5 e5 d5 c5 b4>")
  .s("gm_voice_oohs").velocity(sine.range(.15,.35).slow(16))
  .room(.8).delay(.35).slow(4)
$: note("<[c3,e3,g3] [b2,d3,f3]>")
  .s("gm_warm_pad").velocity(.2).room(.65).slow(8)`,
      },
      {
        label: 'Female Dancehall Fire',
        code: `// female dancehall fire — "Gyal Power"
// Gyal power nothing can we stop
// Riddim drop and all the people rock
// Wine it up from bottom to the top
// Sound a play and speakers gonna pop
// Queens we are and queens on every block
$: note("d4 f4 g4 a4 g4 f4 d4 ~").s("gm_voice_oohs")
  .velocity(.5).room(.3).delay(.1)
$: note("~ d2 ~ d2 ~ f2 ~ g2").s("gm_synth_bass_2").velocity(.55)
$: s("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").gain(.5)
$: s("rim ~ rim ~ rim ~ rim ~").bank("RolandTR808").gain(.3)`,
      },
      {
        label: 'Female Electro Synth',
        code: `// female electro synth — "Neon Pulse"
// Neon pulse is racing through the wire
// Synthesized emotions burning higher
// Code is music music is the code
// Glowing circuits light the endless road
// Digital the future we have sowed
$: note("<[c4,e4,g4] [a3,c4,e4]>").s("gm_synth_choir")
  .velocity(.45).room(.4).slow(2)
$: note("c5 e5 g5 ~ e5 c5 ~ g4").s("gm_synth_voice")
  .velocity(.3).delay(.25)
$: s("bd bd bd bd").bank("RolandTR909").gain(.5)
$: s("~ hh ~ oh ~ hh ~ oh").bank("RolandTR909").gain(.3)`,
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
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.4)
  .lpf(3500).hpf(800)`,
      },
      {
        label: 'Egg Shaker — Quick',
        code: `// egg shaker — quick sixteenths
$: s("hh*8").bank("RolandTR808")
  .gain("[.15 .3 .2 .35 .15 .3 .2 .35]")
  .speed(1.5).lpf(3000).hpf(900)`,
      },
      {
        label: 'Egg Shaker — Shuffle',
        code: `// egg shaker — shuffle feel
$: s("[hh ~ hh] [~ hh ~] [hh ~ hh] [~ hh ~]")
  .bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .2]")
  .speed(1.45).lpf(3200).hpf(850)`,
      },
      {
        label: 'Cabasa — Steady',
        code: `// cabasa — steady groove
$: s("hh*4").bank("RolandTR909")
  .gain("[.35 .55 .4 .6]").speed(1.8)
  .lpf(5000).hpf(1200)`,
      },
      {
        label: 'Cabasa — Syncopated',
        code: `// cabasa — syncopated rhythm
$: s("[hh ~] hh [~ hh] [hh hh]").bank("RolandTR909")
  .gain("[.3 .5 .4 .55]").speed(1.75)
  .lpf(4800).hpf(1100)`,
      },
      {
        label: 'Cabasa — Fast Scrape',
        code: `// cabasa — fast scrape texture
$: s("hh*16").bank("RolandTR909")
  .gain(sine.range(.15,.45).fast(4))
  .speed("[1.7 1.8 1.75 1.85]*4")
  .lpf(5500).hpf(1300)`,
      },
      {
        label: 'Maracas — Classic',
        code: `// maracas — classic Latin pattern
$: s("hh hh [hh hh] hh").bank("RolandTR808")
  .gain("[.3 .5 .7 .5]")
  .speed("[2 2.1 2 2.15]").lpf(6000).hpf(1500)`,
      },
      {
        label: 'Maracas — Double Time',
        code: `// maracas — double time shake
$: s("hh*8").bank("RolandTR808")
  .gain("[.25 .45 .3 .5 .25 .45 .3 .5]")
  .speed("[2 2.1 2.05 2.15 2 2.1 2.05 2.15]")
  .lpf(6500).hpf(1600)`,
      },
      {
        label: 'Maracas — Cumbia',
        code: `// maracas — cumbia groove
$: s("[hh hh] hh [hh hh] hh [hh ~] hh")
  .bank("RolandTR808")
  .gain("[.3 .55 .4 .6 .5 .3]")
  .speed("[2 2.1 1.95 2.15 2.05 2]")
  .lpf(5800).hpf(1400)`,
      },
      {
        label: 'Tambourine — On Beat',
        code: `// tambourine — on every beat
$: s("oh*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .55]").speed(1.6)
  .lpf(7000).hpf(1000)`,
      },
      {
        label: 'Tambourine — Backbeat',
        code: `// tambourine — backbeat hits
$: s("~ oh ~ oh").bank("RolandTR808")
  .gain("[.4 .6]").speed(1.55)
  .lpf(6500).hpf(950)`,
      },
      {
        label: 'Tambourine — Gospel Roll',
        code: `// tambourine — gospel roll
$: s("[oh oh] oh [oh oh] [oh oh oh]")
  .bank("RolandTR808")
  .gain("[.25 .4 .35 .5 .6 .45 .55 .35]")
  .speed("[1.55 1.6 1.5 1.65 1.55 1.6 1.5 1.6]")
  .lpf(7000).hpf(1000)`,
      },
      {
        label: 'Tambourine — Sizzle',
        code: `// tambourine — sizzle and shimmer
$: s("oh*8").bank("RolandTR909")
  .gain("[.15 .3 .2 .4 .2 .35 .2 .4]")
  .speed(1.65).lpf(8000).hpf(1100).room(.2)`,
      },
      {
        label: 'Rain Stick — Slow',
        code: `// rain stick — slow falling beads
$: s("hh(5,8)").bank("RolandTR808")
  .gain(sine.range(.1,.35).slow(4))
  .speed(sine.range(1.2,2).slow(8))
  .lpf(2500).hpf(600).room(.45).delay(.15)`,
      },
      {
        label: 'Rain Stick — Dense',
        code: `// rain stick — dense bead cascade
$: s("hh(7,16)").bank("RolandTR808")
  .gain(sine.range(.08,.3).slow(6))
  .speed(sine.range(1.5,2.5).slow(4))
  .lpf(3000).hpf(700).room(.5).delay(.2)`,
      },
      {
        label: 'Seed Shaker — Soft',
        code: `// seed shaker — soft organic rattle
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.12 .22 .15 .25]").speed(1.3)
  .lpf(2200).hpf(500).room(.3)`,
      },
      {
        label: 'Seed Shaker — Groove',
        code: `// seed shaker — groove pocket
$: s("[hh ~] [~ hh] [hh hh] [~ hh]")
  .bank("RolandTR808")
  .gain("[.15 .28 .2 .32]").speed(1.35)
  .lpf(2400).hpf(550).room(.25)`,
      },
      {
        label: 'Caxixi — Berimbau',
        code: `// caxixi — berimbau accompaniment
$: s("[hh hh] [~ hh] [hh hh] [hh ~]")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .45 .3]")
  .speed("[1.6 1.7 1.55 1.7 1.6 1.65]")
  .lpf(4000).hpf(800)`,
      },
      {
        label: 'Caxixi — Fast',
        code: `// caxixi — fast capoeira pattern
$: s("hh*8").bank("RolandTR808")
  .gain("[.25 .45 .3 .5 .25 .45 .35 .55]")
  .speed("[1.6 1.7 1.65 1.75 1.6 1.7 1.65 1.75]")
  .lpf(4200).hpf(900)`,
      },
      {
        label: 'Shekere — West African',
        code: `// shekere — West African net rattle
$: s("[oh hh] oh [hh oh] [oh hh oh]")
  .bank("RolandTR808")
  .gain("[.35 .55 .45 .6 .5 .4 .55]")
  .speed("[1.3 1.5 1.35 1.45 1.3 1.5 1.4]")
  .lpf(5000).hpf(700)`,
      },
      {
        label: 'Shekere — Polyrhythm',
        code: `// shekere — polyrhythmic pattern
$: s("oh(5,8)").bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .45]")
  .speed("[1.35 1.5 1.4 1.45 1.35]")
  .lpf(4800).hpf(750)
$: s("hh(3,8)").bank("RolandTR808")
  .gain("[.25 .4 .35]").speed(1.6)
  .lpf(4000).hpf(800)`,
      },
      {
        label: 'Güiro — Scrape Rhythm',
        code: `// güiro — scrape rhythm
$: s("[hh hh hh hh] hh [hh hh hh hh] hh")
  .bank("RolandTR909")
  .gain("[.2 .25 .3 .25 .5 .2 .25 .3 .25 .5]")
  .speed("[1.9 2 2.1 2 1.5 1.9 2 2.1 2 1.5]")
  .lpf(5500).hpf(1200)`,
      },
      {
        label: 'Güiro — Cha-Cha',
        code: `// güiro — cha-cha pattern
$: s("[hh hh hh] hh ~ [hh hh hh] hh ~")
  .bank("RolandTR909")
  .gain("[.25 .3 .35 .5 .25 .3 .35 .5]")
  .speed("[1.95 2.05 2.1 1.6 1.95 2.05 2.1 1.6]")
  .lpf(5200).hpf(1100)`,
      },
      {
        label: 'Vibraslap — Buzz',
        code: `// vibraslap — buzzing rattle
$: s("~ ~ ~ oh").bank("RolandTR808")
  .gain(.5).speed(.7)
  .lpf(2000).hpf(300).room(.35).slow(2)`,
      },
      {
        label: 'Hi-Hat Shaker — Trap',
        code: `// hi-hat shaker — trap rolls
$: s("hh*16").bank("RolandTR808")
  .gain("[.2 .35 .25 .45 .2 .35 .25 .45 .3 .5 .35 .55 .3 .5 .35 .55]")
  .speed("[1.3 1.35 1.25 1.4]*4")
  .lpf(4000).hpf(800)`,
      },
      {
        label: 'Hi-Hat Shaker — House',
        code: `// hi-hat shaker — house offbeat
$: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.35 .5 .4 .55]")
  .speed(1.35).lpf(4500).hpf(700)`,
      },
      {
        label: 'Hi-Hat Shaker — DnB',
        code: `// hi-hat shaker — drum & bass
$: s("hh*8").bank("RolandTR909").fast(2)
  .gain("[.2 .4 .25 .45 .2 .4 .3 .5]")
  .speed("[1.3 1.4 1.35 1.45 1.3 1.4 1.35 1.45]")
  .lpf(5000).hpf(900)`,
      },
      {
        label: 'Noise Shaker — White',
        code: `// noise shaker — white noise burst
$: s("hh*4").bank("RolandTR808")
  .gain("[.25 .45 .3 .5]").speed(2.5)
  .lpf(4000).hpf(2000)`,
      },
      {
        label: 'Noise Shaker — Pink',
        code: `// noise shaker — filtered pink feel
$: s("hh*4").bank("RolandTR808")
  .gain("[.3 .5 .35 .55]").speed(2.2)
  .lpf(2500).hpf(400).room(.2)`,
      },
      {
        label: 'Noise Shaker — Filtered Sweep',
        code: `// noise shaker — filter sweep
$: s("hh*8").bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .2 .35 .25 .4]")
  .speed(2).lpf(sine.range(1500,6000).slow(4))
  .hpf(sine.range(400,1500).slow(8))`,
      },
      {
        label: 'Shaker — Layered Thick',
        code: `// layered thick shaker — two textures
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.4)
  .lpf(3500).hpf(800)
$: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.15 .25 .18 .3]").speed(1.8)
  .lpf(5000).hpf(1200)`,
      },
      {
        label: 'Shaker — Layered Wide',
        code: `// layered wide shaker — stereo spread
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.2 .35 .25 .4]").speed(1.45)
  .lpf(3200).hpf(700).pan(0.3)
$: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.15 .28 .2 .33]").speed(1.7)
  .lpf(5500).hpf(1100).pan(0.7)`,
      },
      {
        label: 'Shaker — World Fusion',
        code: `// world fusion — egg + tambourine + maracas
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.15 .28 .2 .32]").speed(1.4)
  .lpf(3000).hpf(800)
$: s("~ oh ~ oh").bank("RolandTR808")
  .gain("[.3 .45]").speed(1.55)
  .lpf(6500).hpf(950)
$: s("hh hh [hh hh] hh").bank("RolandTR808")
  .gain("[.2 .35 .5 .35]").speed(2.1)
  .lpf(6000).hpf(1500)`,
      },
      {
        label: 'Shaker — Minimal',
        code: `// minimal micro shaker — barely there
$: s("hh(3,8)").bank("RolandTR808")
  .gain("[.08 .15 .12]").speed(1.5)
  .lpf(2500).hpf(600).room(.4)`,
      },
      {
        label: 'Shaker — Hypnotic',
        code: `// hypnotic shaker — evolving texture
$: s("[~ hh]*4").bank("RolandTR808")
  .gain(sine.range(.1,.4).slow(8))
  .speed(sine.range(1.2,1.8).slow(4))
  .lpf(sine.range(2000,5000).slow(6))
  .hpf(sine.range(400,1200).slow(12)).room(.3)`,
      },
      {
        label: 'Shaker — Polyrhythm',
        code: `// polyrhythmic shaker — 3 against 4
$: s("hh(3,8)").bank("RolandTR808")
  .gain("[.25 .4 .35]").speed(1.45)
  .lpf(3500).hpf(800)
$: s("hh(4,8)").bank("RolandTR909")
  .gain("[.2 .35 .25 .4]").speed(1.7)
  .lpf(5000).hpf(1100)`,
      },
      {
        label: 'Shaker — Euclidean 5/8',
        code: `// euclidean shaker — 5 hits in 8 slots
$: s("hh(5,8)").bank("RolandTR808")
  .gain("[.25 .4 .3 .45 .35]")
  .speed("[1.4 1.5 1.45 1.55 1.4]")
  .lpf(4000).hpf(800)`,
      },
      {
        label: 'Shaker — Euclidean 7/16',
        code: `// euclidean shaker — 7 hits in 16 slots
$: s("hh(7,16)").bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .38 .28]")
  .speed("[1.5 1.6 1.55 1.65 1.5 1.6 1.55]")
  .lpf(4200).hpf(900)`,
      },
      {
        label: 'Shaker — Swing',
        code: `// swing shaker — jazz feel
$: s("[hh ~ hh] [~ hh ~] [hh ~ hh] [~ hh hh]")
  .bank("RolandTR808")
  .gain("[.2 .35 .25 .4 .3 .2]")
  .speed(1.45).lpf(3200).hpf(700).room(.3)`,
      },
      {
        label: 'Shaker — Bossa Nova',
        code: `// bossa nova shaker
$: s("hh [hh hh] hh hh [hh hh] hh hh")
  .bank("RolandTR808")
  .gain("[.2 .35 .3 .25 .35 .3 .2 .3]")
  .speed(1.5).lpf(3500).hpf(750)`,
      },
      {
        label: 'Shaker — Samba',
        code: `// samba ganzá shaker
$: s("[hh hh] hh [hh hh] hh [hh hh] hh")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .35 .5]")
  .speed("[1.6 1.7 1.6 1.7 1.6 1.7]")
  .lpf(4500).hpf(900)`,
      },
      {
        label: 'Shaker — Reggae Skank',
        code: `// reggae offbeat skank shaker
$: s("~ hh ~ hh ~ hh ~ hh")
  .bank("RolandTR808")
  .gain("[.25 .4 .3 .45]").speed(1.35)
  .lpf(3000).hpf(600).room(.3)`,
      },
      {
        label: 'Shaker — Afrobeat',
        code: `// afrobeat shaker pattern
$: s("[hh hh] hh [hh hh] hh [hh hh] hh [hh ~]")
  .bank("RolandTR808")
  .gain("[.3 .5 .4 .55 .35 .5 .45]")
  .speed("[1.5 1.6 1.5 1.6 1.5 1.6 1.5]")
  .lpf(4000).hpf(800)`,
      },
      {
        label: 'Shaker — Dancehall',
        code: `// dancehall shaker riddim
$: s("hh [hh hh] [~ hh] hh").bank("RolandTR808")
  .gain("[.3 .5 .45 .4]")
  .speed("[1.4 1.5 1.45 1.35]")
  .lpf(4500).hpf(900)`,
      },
      {
        label: 'Shaker — Funk',
        code: `// funk shaker — tight pocket
$: s("[hh ~] hh [~ hh] hh [hh hh] [~ hh]")
  .bank("RolandTR909")
  .gain("[.3 .5 .4 .55 .6 .4]")
  .speed(1.5).lpf(4500).hpf(900)`,
      },
      {
        label: 'Shaker — Disco',
        code: `// disco shaker shimmer
$: s("[~ hh]*4, oh(1,8)").bank("RolandTR909")
  .gain("[.3 .5 .4 .6]").speed(1.5)
  .lpf(5000).hpf(800)`,
      },
      {
        label: 'Shaker — Techno',
        code: `// techno industrial shaker
$: s("hh*16").bank("RolandTR909")
  .gain(sine.range(.15,.5).fast(4))
  .speed("[1.4 1.5 1.45 1.55]*4")
  .lpf(5000).hpf(1000)`,
      },
      {
        label: 'Shaker — Lo-Fi Dusty',
        code: `// lo-fi dusty shaker — vinyl feel
$: s("[~ hh]*4").bank("RolandTR808")
  .gain("[.12 .22 .15 .25]").speed(1.3)
  .lpf(2000).hpf(400).room(.35)`,
      },
      {
        label: 'Shaker — Ambient Drift',
        code: `// ambient drifting shaker
$: s("hh(5,16)").bank("RolandTR808")
  .gain(sine.range(.05,.25).slow(8))
  .speed(sine.range(1.2,2).slow(12))
  .lpf(sine.range(1500,4000).slow(6))
  .hpf(500).room(.55).delay(.25)`,
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

  // Panel state
  const [activePanel, setActivePanel] = useState<'sounds' | 'examples' | 'settings' | 'learn' | 'patterns' | 'vibe'>('examples')
  const [activeFilter, setActiveFilter] = useState<SoundFilter>('samples')
  const [soundSearch, setSoundSearch] = useState('')
  const [allSounds, setAllSounds] = useState<Record<string, any>>({})
  const [showPanel, setShowPanel] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)
  const [exampleSearch, setExampleSearch] = useState('')
  const [selectedExample, setSelectedExample] = useState<{ code: string; label: string } | null>(null)

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
  const handleUpdate = useCallback(async () => {
    if (!strudelRef.current?.evaluate || !isPlaying) return
    try {
      setError(null)
      // Flash effect on evaluation
      if (flashOnEval && editorContainerRef.current) {
        editorContainerRef.current.style.outline = '2px solid rgba(34,211,238,0.4)'
        setTimeout(() => { if (editorContainerRef.current) editorContainerRef.current.style.outline = 'none' }, 200)
      }
      const src = codeRef.current.trim()
      if (!src) return
      sliderDefsRef.current = {}
      const { evaluate, webaudio, scheduler } = strudelRef.current as any
      await webaudio.getAudioContext().resume()
      drawStateRef.current.counter = 0  // Reset draw IDs for fresh evaluation
      await evaluate(fixSoundfontNames(src))
      // Force immediate re-sync: restart scheduler clock so new pattern triggers instantly
      // Without this, the clock's 100ms interval causes perceived delay before new sounds play
      if (scheduler?.clock) {
        scheduler.clock.pause()
        scheduler.clock.start()
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
  }, [isPlaying, fixSoundfontNames, flashOnEval])

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
      {/* ─── Compact Top Bar ─── */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06] backdrop-blur-2xl shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]' : status === 'loading' ? 'bg-cyan-300 animate-pulse' : 'bg-white/15'}`} />
          <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">INPUT</span>
          {status === 'loading' && (
            <span className="text-[9px] text-white/20 ml-1">{loadingMsg}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
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
          <button onClick={handleUpdate} disabled={!isPlaying}
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

          {/* Active sounds indicator — flashes when haps trigger */}
          {isPlaying && activeHaps.length > 0 && (
            <div className="flex items-center gap-1 ml-1 max-w-[200px] overflow-hidden">
              {activeHaps.slice(0, 6).map((s, i) => (
                <span key={`${s}-${i}`}
                  className="px-1.5 py-0.5 bg-cyan-500/20 border border-cyan-400/30 rounded text-[8px] font-mono text-cyan-300/80 animate-pulse whitespace-nowrap"
                  style={{ animationDuration: '0.3s' }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center ml-0.5 rounded-md overflow-hidden border border-white/[0.06]">
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
          <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md border border-white/[0.06] bg-white/[0.02]">
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

          <div className="flex items-center ml-1 rounded-md overflow-hidden border border-white/[0.06]">
            <button onClick={() => { setShowPanel(true); setActivePanel('examples') }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'examples' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Examples">
              <Sparkles size={15} />
            </button>
            <button onClick={() => { setShowPanel(true); setActivePanel('sounds') }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'sounds' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Sounds">
              <Volume2 size={15} />
            </button>
            <button onClick={() => { setShowPanel(true); setActivePanel('settings') }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'settings' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Settings">
              <Palette size={15} />
            </button>
            <button onClick={() => { setShowPanel(true); setActivePanel('patterns') }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'patterns' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="My Patterns">
              <FolderOpen size={15} />
            </button>
            <button onClick={() => { setShowPanel(true); setActivePanel('learn') }}
              className={`px-2.5 py-1.5 transition-all cursor-pointer ${showPanel && activePanel === 'learn' ? 'bg-cyan-500/15 text-cyan-400' : 'text-white/25 hover:text-white/50'}`}
              title="Learn">
              <BookOpen size={15} />
            </button>
            <button onClick={() => { setShowPanel(true); setActivePanel('vibe') }}
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
            <button onClick={() => setShowPanel(p => !p)}
              className="px-2 py-1.5 text-white/25 hover:text-white/40 transition cursor-pointer">
              <ChevronRight size={13} className={`transition-transform ${showPanel ? 'rotate-180' : ''}`} />
            </button>
          </div>
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
              style={{ opacity: isPlaying ? 0.45 : 0, transition: 'opacity 1s ease' }}
            />

            {/* ── Manifesto text backdrop — audio-reactive, only on default code ── */}
            {isDefaultCode && (
            <div
              ref={manifestoRef}
              className="absolute inset-0 pointer-events-none z-[4] flex flex-col items-center justify-center select-none overflow-hidden"
              style={{ opacity: isPlaying ? 0.28 : 0.08, transition: 'opacity 1.5s ease' }}
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
                code={code}
                isPlaying={isPlaying}
                onCodeChange={(newCode: string) => {
                  setCode(newCode)
                  undoStackRef.current.push(newCode)
                  redoStackRef.current = []
                }}
                onUpdate={() => handleUpdate()}
              />
            </Suspense>
          </div>
        )}

        {/* ═══ SIDE PANEL ═══ */}
        {showPanel && (
          <div className="w-72 lg:w-80 flex flex-col border-l border-white/[0.06] bg-black/40 shrink-0">

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
                            e.dataTransfer.setData('text/plain', `s("${s.name}")`)
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
    </div>
  )
}
