// ═══════════════════════════════════════════════════════════════
//  PIANO ROLL PRESETS — Music-knowledge-based pattern library
//
//  All presets use SCALE DEGREES (0-indexed from root),
//  NOT absolute note names. This means every preset auto-adapts
//  to whatever key/scale the user has selected.
//
//  Degree 0 = root, 1 = 2nd, 2 = 3rd, 3 = 4th, 4 = 5th, etc.
//  Negative = lower octave, 7+ = higher octave
//  null = rest/silence
//
//  A "chord step" is an array of simultaneous degrees.
//  A "melody step" is a single degree or null.
// ═══════════════════════════════════════════════════════════════

export type PresetStep = number | number[] | null  // degree, chord, or rest

export interface MusicalPreset {
  id: string
  name: string
  desc: string
  category: PresetCategory
  /** Which node types this preset is appropriate for */
  forTypes: ('melody' | 'chords' | 'bass' | 'pad' | 'vocal' | 'other')[]
  /** Scale-degree based steps. Length determines bar count at the grid resolution. */
  steps: PresetStep[]
  /** Octave offset from the node type's default range center */
  octaveOffset?: number
  /** Tags for search */
  tags: string[]
}

export type PresetCategory =
  | 'chord-progression'
  | 'melody'
  | 'bassline'
  | 'arpeggio'
  | 'pad'
  | 'rhythm'

export const PRESET_CATEGORY_META: Record<PresetCategory, { label: string; icon: string; color: string }> = {
  'chord-progression': { label: 'Progressions', icon: '🎹', color: '#c084fc' },
  'melody':            { label: 'Melodies',     icon: '🎵', color: '#22d3ee' },
  'bassline':          { label: 'Bass Lines',   icon: '🎸', color: '#f472b6' },
  'arpeggio':          { label: 'Arpeggios',    icon: '⬆', color: '#34d399' },
  'pad':               { label: 'Pads & Holds', icon: '☁️', color: '#818cf8' },
  'rhythm':            { label: 'Rhythmic',     icon: '🥁', color: '#fb923c' },
}

// ═══════════════════════════════════════════════════════════════
//  CHORD PROGRESSIONS (4-bar and 8-bar)
//  Each step = 1 beat (quarter note). 16 steps = 4 bars.
// ═══════════════════════════════════════════════════════════════

const CHORD_PROGRESSIONS: MusicalPreset[] = [
  // ── 4-BAR PROGRESSIONS (16 steps at quarter-note resolution) ──
  {
    id: 'prog_pop',
    name: 'Pop (I-V-vi-IV)',
    desc: 'The hit maker — used in thousands of pop songs',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['pop', 'happy', 'major', '4-bar'],
    steps: [
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],       // I
      [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7], // V
      [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], // vi
      [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], // IV
    ],
  },
  {
    id: 'prog_sad',
    name: 'Sad Minor (i-VI-III-VII)',
    desc: 'Emotional minor key — ballads, indie, emo',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['sad', 'minor', 'emotional', '4-bar'],
    steps: [
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],           // i
      [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], // VI
      [2, 4, 6], [2, 4, 6], [2, 4, 6], [2, 4, 6],             // III
      [6, 1+7, 3+7], [6, 1+7, 3+7], [6, 1+7, 3+7], [6, 1+7, 3+7], // VII
    ],
  },
  {
    id: 'prog_jazz_251',
    name: 'Jazz ii-V-I',
    desc: 'The most important jazz progression — smooth resolution',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['jazz', 'smooth', 'sophisticated', '4-bar'],
    steps: [
      [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], // ii7
      [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], // V7
      [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], // Imaj7
      [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], // Imaj7 (hold)
    ],
  },
  {
    id: 'prog_lofi',
    name: 'Lofi Chill',
    desc: '7th chords — downtempo beats, study music',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['lofi', 'chill', 'jazzy', 'relaxed', '4-bar'],
    steps: [
      [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], // ii7
      [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], // V7
      [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], // Imaj7
      [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7], // vi9
    ],
  },
  {
    id: 'prog_blues',
    name: '12-Bar Blues',
    desc: 'The foundation of rock, blues, and R&B',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['blues', 'rock', 'classic', '4-bar'],
    steps: [
      // Standard 12-bar shortened to 16 steps (triads only)
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],     // I  I  I  I
      [3, 5, 0+7], [3, 5, 0+7], [0, 2, 4], [0, 2, 4],   // IV IV I  I
      [4, 6, 1+7], [3, 5, 0+7], [0, 2, 4], [0, 2, 4],   // V  IV I  I
      [4, 6, 1+7], [4, 6, 1+7], [0, 2, 4], [4, 6, 1+7], // V  V  I  V(turnaround)
    ],
  },
  {
    id: 'prog_dreamy',
    name: 'Dreamy Wash',
    desc: 'Ethereal — ambient, shoegaze, dream pop',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['dreamy', 'ambient', 'ethereal', 'spacey', '4-bar'],
    steps: [
      [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7],   // I(sus-ish open voicing)
      [5, 2+7, 0+14], [5, 2+7, 0+14], [5, 2+7, 0+14], [5, 2+7, 0+14], // vi(open)
      [3, 0+7, 5+7], [3, 0+7, 5+7], [3, 0+7, 5+7], [3, 0+7, 5+7], // IV(open)
      [4, 1+7, 4+7], [4, 1+7, 4+7], [4, 1+7, 4+7], [4, 1+7, 4+7], // V(open)
    ],
  },
  {
    id: 'prog_neosoul',
    name: 'Neo Soul',
    desc: 'Rich extended chords — D\'Angelo, Erykah Badu vibes',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['neo-soul', 'rnb', 'rich', 'extended', '4-bar'],
    steps: [
      [1, 3, 5, 0+7, 2+7], [1, 3, 5, 0+7, 2+7], [1, 3, 5, 0+7, 2+7], [1, 3, 5, 0+7, 2+7], // ii9
      [4, 6, 1+7, 3+7, 5+7], [4, 6, 1+7, 3+7, 5+7], [4, 6, 1+7, 3+7, 5+7], [4, 6, 1+7, 3+7, 5+7], // V13
      [0, 2, 4, 6, 1+7], [0, 2, 4, 6, 1+7], [0, 2, 4, 6, 1+7], [0, 2, 4, 6, 1+7], // Imaj9
      [5, 0+7, 2+7, 4+7, 6+7], [5, 0+7, 2+7, 4+7, 6+7], [5, 0+7, 2+7, 4+7, 6+7], [5, 0+7, 2+7, 4+7, 6+7], // vi11
    ],
  },
  {
    id: 'prog_edm',
    name: 'EDM Anthem',
    desc: 'Big room / festival — power chords, simple & wide',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['edm', 'dance', 'festival', 'big', '4-bar'],
    steps: [
      [0, 4, 0+7], [0, 4, 0+7], [0, 4, 0+7], [0, 4, 0+7],       // I (root + 5th + oct)
      [5, 2+7, 5+7], [5, 2+7, 5+7], [5, 2+7, 5+7], [5, 2+7, 5+7], // vi
      [3, 0+7, 3+7], [3, 0+7, 3+7], [3, 0+7, 3+7], [3, 0+7, 3+7], // IV
      [4, 1+7, 4+7], [4, 1+7, 4+7], [4, 1+7, 4+7], [4, 1+7, 4+7], // V
    ],
  },

  // ── 8-BAR PROGRESSIONS (32 steps) ──
  {
    id: 'prog_8bar_pop',
    name: '8-Bar Pop Verse',
    desc: 'Full verse — I-V-vi-IV twice with variation',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['pop', '8-bar', 'verse', 'full'],
    steps: [
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
      [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7],
      [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7],
      [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7],
      // Bar 5-8: variation
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
      [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7],
      [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7], [5, 0+7, 2+7],
      [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7], [4, 6, 1+7],
    ],
  },
  {
    id: 'prog_8bar_lofi',
    name: '8-Bar Lofi Study',
    desc: 'Warm 7th chord cycle — perfect for study beats',
    category: 'chord-progression',
    forTypes: ['chords', 'pad'],
    tags: ['lofi', '8-bar', 'chill', 'study'],
    steps: [
      [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7],
      [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7], [4, 6, 1+7, 3+7],
      [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6],
      [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7], [5, 0+7, 2+7, 4+7],
      [3, 5, 0+7, 2+7], [3, 5, 0+7, 2+7], [3, 5, 0+7, 2+7], [3, 5, 0+7, 2+7],
      [2, 4, 6, 1+7], [2, 4, 6, 1+7], [2, 4, 6, 1+7], [2, 4, 6, 1+7],
      [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7], [1, 3, 5, 0+7],
      [2, 4+7-7, 6, 1+7], [2, 4+7-7, 6, 1+7], [2, 4+7-7, 6, 1+7], [2, 4+7-7, 6, 1+7],
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
//  MELODIES — idiomatic phrases per genre
//  Each step = 1 sixteenth note (16 steps = 1 bar)
// ═══════════════════════════════════════════════════════════════

const MELODIES: MusicalPreset[] = [
  // ── 1-BAR PHRASES (16 steps) ──
  {
    id: 'mel_pop_hook',
    name: 'Pop Hook',
    desc: 'Catchy stepwise melody — radio-friendly',
    category: 'melody',
    forTypes: ['melody', 'vocal', 'other'],
    tags: ['pop', 'catchy', 'hook', '1-bar'],
    steps: [0, null, 2, null, 4, null, 2, null, 0, null, null, null, 4, 2, 0, null],
  },
  {
    id: 'mel_rnb_smooth',
    name: 'R&B Smooth',
    desc: 'Soulful pentatonic — smooth R&B vocal line',
    category: 'melody',
    forTypes: ['melody', 'vocal', 'other'],
    tags: ['rnb', 'soul', 'smooth', '1-bar'],
    steps: [null, 0, null, 2, 4, null, 5, 4, null, 2, null, 0, null, null, -1, 0],
  },
  {
    id: 'mel_jazz_phrase',
    name: 'Jazz Bebop Lick',
    desc: 'Classic bebop phrase — 8th-note runs',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['jazz', 'bebop', 'lick', '1-bar'],
    steps: [0, 1, 2, 3, 4, null, 3, 2, 1, 0, null, -1, 0, null, null, null],
  },
  {
    id: 'mel_edm_lead',
    name: 'EDM Lead',
    desc: 'Rhythmic synth lead — festival energy',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['edm', 'lead', 'energy', '1-bar'],
    steps: [0, 0, null, 0, null, 4, null, 4, 0+7, null, 4, null, 0, null, null, null],
  },
  {
    id: 'mel_classical_motif',
    name: 'Classical Motif',
    desc: 'Elegant rising phrase — Bach/Mozart inspired',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['classical', 'elegant', 'motif', '1-bar'],
    steps: [0, null, 1, null, 2, null, 3, null, 4, null, 5, null, 6, null, 4, null],
  },
  {
    id: 'mel_ambient_float',
    name: 'Ambient Float',
    desc: 'Sparse and spacious — lots of breath',
    category: 'melody',
    forTypes: ['melody', 'pad', 'vocal', 'other'],
    tags: ['ambient', 'sparse', 'dreamy', '1-bar'],
    steps: [0, null, null, null, null, null, 4, null, null, null, null, null, 2, null, null, null],
  },
  {
    id: 'mel_trap_dark',
    name: 'Trap Melody',
    desc: 'Dark minor key — heavy 808 vibes',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['trap', 'dark', 'minor', '1-bar'],
    steps: [0, null, null, 2, null, 3, 2, null, 0, null, -2, null, 0, null, null, null],
  },
  {
    id: 'mel_funk_riff',
    name: 'Funk Riff',
    desc: 'Syncopated groove — tight 16th-note feel',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['funk', 'groove', 'syncopated', '1-bar'],
    steps: [0, null, 0, 2, null, 4, null, 2, 0, null, -1, 0, null, 2, null, null],
  },

  // ── 2-BAR PHRASES (32 steps) ──
  {
    id: 'mel_pop_verse',
    name: 'Pop Verse (2-bar)',
    desc: 'Full verse melody — question & answer phrasing',
    category: 'melody',
    forTypes: ['melody', 'vocal', 'other'],
    tags: ['pop', 'verse', '2-bar', 'phrasing'],
    steps: [
      0, null, 2, null, 4, null, 5, 4, null, 2, null, 0, null, null, null, null,  // question
      0, null, 2, null, 4, null, 5, 6, null, 4+7, null, 2+7, 0+7, null, null, null, // answer (rises)
    ],
  },
  {
    id: 'mel_lofi_2bar',
    name: 'Lofi Keys (2-bar)',
    desc: 'Laid-back piano — headnod groove',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['lofi', 'chill', '2-bar', 'piano'],
    steps: [
      null, 0, null, null, 2, null, 4, null, null, 6, null, 4, null, null, 2, null,
      null, 0, null, null, -1, null, 0, null, null, 2, null, null, 4, null, null, null,
    ],
  },
  {
    id: 'mel_cinematic_2bar',
    name: 'Cinematic Theme (2-bar)',
    desc: 'Epic rising phrase — movie trailer energy',
    category: 'melody',
    forTypes: ['melody', 'other'],
    tags: ['cinematic', 'epic', '2-bar', 'rising'],
    steps: [
      0, null, null, null, 1, null, 2, null, null, null, 4, null, null, null, null, null,
      4, null, null, null, 5, null, 6, null, null, null, 4+7, null, null, null, null, null,
    ],
  },

  // ── 4-BAR MELODIES (64 steps) ──
  {
    id: 'mel_pop_4bar',
    name: 'Pop Chorus (4-bar)',
    desc: 'Full chorus melody — singable, memorable',
    category: 'melody',
    forTypes: ['melody', 'vocal', 'other'],
    tags: ['pop', 'chorus', '4-bar', 'singable'],
    steps: [
      // Bar 1: establish
      0, null, 2, null, 4, null, 4, null, 2, null, null, null, null, null, null, null,
      // Bar 2: develop
      4, null, 5, null, 4+7, null, 4, null, 2, null, 0, null, null, null, null, null,
      // Bar 3: peak
      4+7, null, null, null, 2+7, null, 4+7, null, 5+7, null, null, null, 4+7, null, 2+7, null,
      // Bar 4: resolve
      0+7, null, null, null, 6, null, 4, null, 2, null, null, null, 0, null, null, null,
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
//  BASS LINES
// ═══════════════════════════════════════════════════════════════

const BASSLINES: MusicalPreset[] = [
  {
    id: 'bass_root_8th',
    name: 'Root Eighth Notes',
    desc: 'Pumping root notes — rock, punk, dance',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['basic', 'root', 'eighth', '1-bar'],
    steps: [0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null, 0, null],
  },
  {
    id: 'bass_root_5th',
    name: 'Root-Fifth',
    desc: 'Classic rock/country bass — root to fifth',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['rock', 'country', 'classic', '1-bar'],
    steps: [0, null, null, null, 0, null, null, null, 4, null, null, null, 4, null, null, null],
  },
  {
    id: 'bass_walking',
    name: 'Walking Bass',
    desc: 'Jazz walking — stepwise motion through scale',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['jazz', 'walking', 'movement', '1-bar'],
    steps: [0, null, null, null, 1, null, null, null, 2, null, null, null, 3, null, null, null],
  },
  {
    id: 'bass_808_bounce',
    name: '808 Bounce',
    desc: 'Trap 808 — sub hits with slides',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['trap', '808', 'bounce', 'hip-hop', '1-bar'],
    octaveOffset: -1,
    steps: [0, null, null, null, null, null, null, 0, null, null, 0, null, null, null, null, null],
  },
  {
    id: 'bass_funk_slap',
    name: 'Funk Slap',
    desc: 'Syncopated funk bass — groovy 16th feel',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['funk', 'slap', 'groove', '1-bar'],
    steps: [0, null, 0, null, null, 4, null, 0, null, null, 0, 2, null, 0, null, null],
  },
  {
    id: 'bass_disco_octave',
    name: 'Disco Octave',
    desc: 'Classic disco/house — octave pump',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['disco', 'house', 'dance', '1-bar'],
    steps: [0, null, 0+7, null, 0, null, 0+7, null, 0, null, 0+7, null, 0, null, 0+7, null],
  },
  {
    id: 'bass_reggae',
    name: 'Reggae One-Drop',
    desc: 'Offbeat emphasis — roots reggae feel',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['reggae', 'offbeat', 'dub', '1-bar'],
    steps: [null, null, null, null, 0, null, null, null, null, null, null, null, 4, null, 0, null],
  },
  {
    id: 'bass_walking_2bar',
    name: 'Walking Jazz (2-bar)',
    desc: 'Full walking bass line — through chord tones',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['jazz', 'walking', '2-bar', 'through'],
    steps: [
      0, null, null, null, 1, null, null, null, 2, null, null, null, 3, null, null, null,
      4, null, null, null, 3, null, null, null, 2, null, null, null, 1, null, null, null,
    ],
  },
  {
    id: 'bass_latin',
    name: 'Latin Tumbao',
    desc: 'Afro-Cuban bass pattern — salsa/son',
    category: 'bassline',
    forTypes: ['bass'],
    tags: ['latin', 'tumbao', 'salsa', '1-bar'],
    steps: [null, null, null, 0, null, null, 4, null, null, null, null, 0, null, null, 0+7, null],
  },
]

// ═══════════════════════════════════════════════════════════════
//  ARPEGGIOS — various patterns and speeds
// ═══════════════════════════════════════════════════════════════

const ARPEGGIOS: MusicalPreset[] = [
  {
    id: 'arp_up_triad',
    name: 'Triad Up',
    desc: 'Root-3rd-5th ascending — classic arpeggio',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'pad', 'other'],
    tags: ['arp', 'up', 'triad', '1-bar'],
    steps: [0, null, null, null, 2, null, null, null, 4, null, null, null, 0+7, null, null, null],
  },
  {
    id: 'arp_down_triad',
    name: 'Triad Down',
    desc: '5th-3rd-root descending',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'pad', 'other'],
    tags: ['arp', 'down', 'triad', '1-bar'],
    steps: [0+7, null, null, null, 4, null, null, null, 2, null, null, null, 0, null, null, null],
  },
  {
    id: 'arp_up_7th',
    name: 'Seventh Up',
    desc: 'Root-3-5-7 — jazzy four-note arp',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['arp', 'up', '7th', 'jazz', '1-bar'],
    steps: [0, null, null, null, 2, null, null, null, 4, null, null, null, 6, null, null, null],
  },
  {
    id: 'arp_bounce',
    name: 'Bounce (Up-Down)',
    desc: 'Up then back down — perpetual motion',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['arp', 'bounce', 'updown', '1-bar'],
    steps: [0, null, 2, null, 4, null, 0+7, null, 4, null, 2, null, 0, null, null, null],
  },
  {
    id: 'arp_16th_fast',
    name: 'Fast 16ths',
    desc: 'Rapid 16th-note arpeggio — trance/EDM',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['arp', 'fast', '16th', 'trance', '1-bar'],
    steps: [0, 2, 4, 0+7, 0, 2, 4, 0+7, 0, 2, 4, 0+7, 0, 2, 4, 0+7],
  },
  {
    id: 'arp_broken_chord',
    name: 'Broken Chord',
    desc: 'Irregular rhythm — classical piano feel',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['arp', 'broken', 'piano', 'classical', '1-bar'],
    steps: [0, null, 4, 2, null, 0+7, null, 4, 0, null, 2, null, 4, null, 0+7, null],
  },
  {
    id: 'arp_alberti',
    name: 'Alberti Bass',
    desc: 'Root-5th-3rd-5th — Mozart\'s favorite pattern',
    category: 'arpeggio',
    forTypes: ['melody', 'bass', 'other'],
    tags: ['arp', 'alberti', 'classical', '1-bar'],
    steps: [0, null, 4, null, 2, null, 4, null, 0, null, 4, null, 2, null, 4, null],
  },
  {
    id: 'arp_2bar_sweep',
    name: 'Full Sweep (2-bar)',
    desc: 'Wide ascending sweep across octaves',
    category: 'arpeggio',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['arp', 'sweep', '2-bar', 'wide'],
    steps: [
      0, null, 2, null, 4, null, 6, null, 0+7, null, 2+7, null, 4+7, null, 6+7, null,
      0+14, null, 6+7, null, 4+7, null, 2+7, null, 0+7, null, 6, null, 4, null, 2, null,
    ],
  },
]

// ═══════════════════════════════════════════════════════════════
//  PADS — sustained chords and textures
// ═══════════════════════════════════════════════════════════════

const PADS: MusicalPreset[] = [
  {
    id: 'pad_simple_hold',
    name: 'Simple Triad Hold',
    desc: 'One sustained chord — fundamental pad',
    category: 'pad',
    forTypes: ['pad', 'chords'],
    tags: ['pad', 'simple', 'hold', '1-bar'],
    steps: [[0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
            [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4]],
  },
  {
    id: 'pad_7th_hold',
    name: 'Maj7 Pad',
    desc: 'Rich seventh chord — warm and full',
    category: 'pad',
    forTypes: ['pad', 'chords'],
    tags: ['pad', '7th', 'warm', '1-bar'],
    steps: [[0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6],
            [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6], [0, 2, 4, 6]],
  },
  {
    id: 'pad_swell_2bar',
    name: 'Chord Swell (2-bar)',
    desc: 'Two chords — slow alternation like breathing',
    category: 'pad',
    forTypes: ['pad', 'chords'],
    tags: ['pad', 'swell', '2-bar', 'breathing'],
    steps: [
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
      [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4], [0, 2, 4],
      [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7],
      [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7], [3, 5, 0+7],
    ],
  },
  {
    id: 'pad_open_voicing',
    name: 'Open Voicing Pad',
    desc: 'Spread across octaves — cinematic feel',
    category: 'pad',
    forTypes: ['pad', 'chords'],
    tags: ['pad', 'open', 'cinematic', '1-bar'],
    steps: [[0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7],
            [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7], [0, 4, 2+7]],
  },
]

// ═══════════════════════════════════════════════════════════════
//  RHYTHMIC — percussive note patterns
// ═══════════════════════════════════════════════════════════════

const RHYTHMIC: MusicalPreset[] = [
  {
    id: 'rhy_4_floor',
    name: 'Four on the Floor',
    desc: 'Straight quarter notes — house, disco, rock',
    category: 'rhythm',
    forTypes: ['melody', 'bass', 'other'],
    tags: ['rhythm', 'quarter', 'four', 'house', '1-bar'],
    steps: [0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null],
  },
  {
    id: 'rhy_offbeat',
    name: 'Offbeat Skank',
    desc: 'Reggae/ska upbeats — "&" of every beat',
    category: 'rhythm',
    forTypes: ['melody', 'chords', 'other'],
    tags: ['rhythm', 'offbeat', 'reggae', 'ska', '1-bar'],
    steps: [null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null],
  },
  {
    id: 'rhy_tresillo',
    name: 'Tresillo',
    desc: '3+3+2 rhythm — Afro-Cuban foundation of pop',
    category: 'rhythm',
    forTypes: ['melody', 'bass', 'other'],
    tags: ['rhythm', 'tresillo', 'latin', 'afro-cuban', '1-bar'],
    steps: [0, null, null, 0, null, null, 0, null, null, null, null, null, null, null, null, null],
  },
  {
    id: 'rhy_clave',
    name: 'Son Clave (3-2)',
    desc: 'The master rhythm — Cuban music foundation',
    category: 'rhythm',
    forTypes: ['melody', 'bass', 'other'],
    tags: ['rhythm', 'clave', 'latin', '2-bar'],
    steps: [
      0, null, null, 0, null, null, 0, null, null, null, null, null, null, null, null, null,
      null, null, 0, null, null, null, null, null, 0, null, null, null, null, null, null, null,
    ],
  },
  {
    id: 'rhy_shuffle',
    name: 'Shuffle Feel',
    desc: 'Swung triplet pattern — blues/jazz groove',
    category: 'rhythm',
    forTypes: ['melody', 'bass', 'other'],
    tags: ['rhythm', 'shuffle', 'swing', 'blues', '1-bar'],
    steps: [0, null, null, 0, null, null, 0, null, null, 0, null, null, 0, null, null, null],
  },
]

// ═══════════════════════════════════════════════════════════════
//  EXPORT ALL PRESETS
// ═══════════════════════════════════════════════════════════════

export const ALL_PRESETS: MusicalPreset[] = [
  ...CHORD_PROGRESSIONS,
  ...MELODIES,
  ...BASSLINES,
  ...ARPEGGIOS,
  ...PADS,
  ...RHYTHMIC,
]

/** Get presets filtered by node type, with best matches first */
export function getPresetsForType(nodeType: string): MusicalPreset[] {
  return ALL_PRESETS.filter(p => p.forTypes.includes(nodeType as any))
}

/** Search presets by query string (matches name, desc, tags) */
export function searchPresets(query: string, nodeType?: string): MusicalPreset[] {
  const q = query.toLowerCase()
  let results = ALL_PRESETS.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.desc.toLowerCase().includes(q) ||
    p.tags.some(t => t.includes(q))
  )
  if (nodeType) {
    results = results.filter(p => p.forTypes.includes(nodeType as any))
  }
  return results
}
