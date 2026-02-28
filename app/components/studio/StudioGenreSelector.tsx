'use client'

// Genre Templates: the PRO way to make songs
// Derived from real Strudel live-coding sessions.
// Each uses: $: / $name: blocks, stack(), .scope(), .pianoroll(),
// slider(), .trans(), .duck(), .off(), .jux(), perlin, etc.
//
// IMPORTANT: Only use methods that exist in the installed Strudel packages:
// - .scope() / .pianoroll() (NOT ._scope / ._pianoroll - underscore prefix doesn't exist)
// - .duck(orbit) .duckattack() .duckdepth() - sidechain ducking
// - .trans() - transpose from @strudel/tonal
// - .beat(positions, divisions) - from @strudel/core
// - Standard controls: .lpf .hpf .lpq .lpenv .shape .room .delay .distort .gain .speed .pan .orbit etc.
// - Signals: saw, sine, perlin, irand, rand
// - slider(default, min, max) - transpiler converts to sliderWithID

export interface GenreTemplate {
  id: string
  label: string
  icon: string
  bpm: number
  desc: string
  code: string
}

export const GENRE_TEMPLATES: GenreTemplate[] = [
  {
    id: 'acid',
    label: 'ACID TECHNO',
    icon: '\u2697\uFE0F',
    bpm: 140,
    desc: 'Squelchy 303 acid with sidechain ducking',
    code: `setCps(140/60/4)

// LETS MAKE ACID

$: s("bd!4").gain(.85)
  .shape(.2).lpf(250)
  .duck(2).duckattack(.2).duckdepth(.8)
  .scope()

$bass: n(irand(10).sub(7).seg(16)).scale("c:minor")
  .s("sawtooth").lpf(200).lpenv(slider(2.28, 0, 8))
  .lpq(12).orbit(2)
  .distort(.8)
  .pianoroll()

$: s("supersaw").detune(1).rel(5)
  .beat(2, 32).slow(2).orbit(3)
  .room(.3).gain(.15)
  .scope()

$: s("hh*8").gain("[.15 .25]*4")
  .lpf(3000).hpf(800)
  .speed("[1 1.2 1 1.4]*2")
  .orbit(4).scope()`,
  },
  {
    id: 'trance',
    label: 'TRANCE',
    icon: '\uD83C\uDF00',
    bpm: 138,
    desc: 'Euphoric leads with trans()',
    code: `setCps(138/60/4)

// LET US TRANCE ONCE MORE

$: n("<0 4 0 9 7>*16").scale("g:minor").trans(-12)
  .o(3).s("sawtooth")
  .lpf(100).lpenv(slider(4, 0, 9)).lps(.2).lpd(.12)
  .pianoroll()

$: n("<0>*16").scale("g:minor").trans(-24)
  .o(4).s("supersaw")
  .lpf(100).lpenv(slider(4, 0, 9)).lps(.2).lpd(.12)
  .gain(.6)
  .pianoroll()

$: s("bd:2!4")
  .duck(3).duckdepth(.8).duckattack(.16)
  .gain(.8).scope()

$: s("bd*4").gain(.9).scope()

$: s("~ cp ~ ~").gain(.6)
  .room(.3).delay(.15).scope()

$: s("hh*8").gain("[.2 .35]*4")
  .speed("[1 1.3]*4").hpf(1000).scope()`,
  },
  {
    id: 'house',
    label: 'DEEP HOUSE',
    icon: '\uD83C\uDFE0',
    bpm: 124,
    desc: 'Warm deep house with chord stabs and rumble',
    code: `setCps(124/60/4)

// DEEP HOUSE VIBRATIONS

$kick: s("bd*4").bank("RolandTR909")
  .gain(.85).lpf(300).shape(.1)
  .scope()

$clap: s("~ cp ~ ~").bank("RolandTR909")
  .gain(.55).room(.35).delay(.08)
  .scope()

$hats: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.3 .5 .35 .6]")
  .speed("[1 1.15 1 1.2]").hpf(800)
  .scope()

$bass: note("<c2 c2 a1 b1>*2")
  .s("sawtooth").gain(.45)
  .lpf(slider(400, 80, 2000)).lpq(4).shape(.12)
  .duck(1).duckdepth(.7).duckattack(.2)
  .pianoroll()

$chords: note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("gm_epiano1").gain(slider(.2, 0, .5))
  .lpf(1800).room(.4).delay(.15).delayfeedback(.3)
  .slow(2)
  .pianoroll()`,
  },
  {
    id: 'boombap',
    label: 'BOOM BAP',
    icon: '\uD83C\uDFA4',
    bpm: 92,
    desc: 'Classic hip-hop boom bap with vinyl warmth',
    code: `setCps(92/60/4)

// BOOM BAP CLASSIC

$: stack(
  s("bd*<4!7 [4 8]>")
    .bank("RolandTR808")
    .shape(.4).gain(.85)
    ,
  s("[~ [sd,rim]]*2")
    .dec(".1 .15")
    .bank("RolandTR909")
    .shape(.4).speed(.7)
    ,
  s("[~ hh]*4")
    .gain("[.25 .1]*4")
    .room(0.1)
    .lpf(saw.slow(8).range(8000,200))
).scope()

$bass: note("<c2 [~ c2] f1 g1>")
  .s("sine").gain(.5)
  .lpf(180).shape(.15)
  .duck(1).duckdepth(.6)
  .pianoroll()

$keys: note("<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3] [a2,c3,e3]>")
  .s("gm_epiano1").gain(.18)
  .lpf(1400).room(.5).delay(.12)
  .slow(2)
  .pianoroll()`,
  },
  {
    id: 'ambient',
    label: 'AMBIENT',
    icon: '\uD83C\uDF0A',
    bpm: 72,
    desc: 'Drifting textures with perlin modulation',
    code: `setCps(72/60/4)

// OCEAN OF SOUND

$pad: note("<[c3,e3,g3,b3] [a2,c3,e3,g3] [f3,a3,c4,e4] [d3,f3,a3,c4]>")
  .s("sawtooth").gain(slider(.04, 0, .1))
  .lpf(perlin.range(300, 900).slow(8))
  .room(.9).delay(.3).delayfeedback(.55)
  .slow(4)
  .scope()

$shimmer: n("<4 3 2 1 2 3>*4").scale("C5:major")
  .s("gm_music_box").gain(.03)
  .room(.85).delay(.25).delayfeedback(.5)
  .lpf(2800).hpf(400)
  .jux(rev).off(1/8, x => x.speed(.5).gain(.02))
  .slow(2)
  .pianoroll()

$: s("hh*8").gain(sine.range(.005,.02).slow(16))
  .speed("[2.5 2.8 2.3 2.7]*2")
  .lpf(1200).hpf(600)
  .room(.7).pan(sine.range(.2,.8).slow(12))
  .scope()

$rumble: s("bd:3").gain(sine.range(0,.025).slow(20))
  .speed(.2).lpf(100)
  .room(.95).slow(8)
  .scope()`,
  },
  {
    id: 'dnb',
    label: 'DRUM & BASS',
    icon: '\u26A1',
    bpm: 174,
    desc: 'Fast breakbeats with reese bass',
    code: `setCps(174/60/4)

// LIQUID DnB

$drums: stack(
  s("bd [~ bd] ~ bd")
    .bank("RolandTR909").gain(.8).shape(.2),
  s("~ sd ~ [sd ~]")
    .bank("RolandTR909").gain(.65).room(.2),
  s("hh*8")
    .gain("[.2 .4 .25 .5 .2 .45 .25 .55]")
    .speed("[1 1.2]*4").hpf(1000)
).scope()

$bass: note("<c1 [~ c1] eb1 [f1 ~]>*2")
  .s("sawtooth").gain(.4)
  .lpf(slider(300, 60, 1500)).lpq(6)
  .shape(.25).distort(.15)
  .duck(1).duckdepth(.75).duckattack(.1)
  .pianoroll()

$: n("<0 4 7 [4 0]>*2").scale("C4:minor")
  .s("gm_piano").gain(.15)
  .room(.5).delay(.2).delayfeedback(.35)
  .lpf(2000)
  .pianoroll()`,
  },
  {
    id: 'techno',
    label: 'DARK TECHNO',
    icon: '\uD83D\uDD0A',
    bpm: 132,
    desc: 'Industrial techno with generative patterns',
    code: `setCps(132/60/4)

// DARK FACTORY

$kick: s("bd*4").gain(.9)
  .shape(.2).lpf(250)
  .scope()

$perc: s("[~ rim] [~ cp:3] [rim ~] [~ ~]")
  .gain(.35).room(.4)
  .speed(perlin.range(.8, 1.3).slow(4))
  .delay(.1).delayfeedback(.2)
  .scope()

$hats: s("hh*16").gain(perlin.range(.05,.25).slow(2))
  .speed(perlin.range(1, 2).slow(3))
  .lpf(perlin.range(2000, 6000).slow(5))
  .hpf(800).pan(sine.range(.2,.8).slow(7))
  .scope()

$bass: n(irand(8).sub(4).seg(8)).scale("c:minor")
  .s("sawtooth").gain(.35)
  .lpf(slider(200, 50, 800)).lpenv(3).lpq(8)
  .shape(.3).orbit(2)
  .duck(1).duckdepth(.8)
  .pianoroll()

$: s("supersaw").detune(2).gain(.08)
  .room(.6).delay(.3).delayfeedback(.45)
  .lpf(perlin.range(400, 1200).slow(6))
  .beat(4, 16).slow(4).orbit(3)
  .scope()`,
  },
  {
    id: 'lofi',
    label: 'LOFI CHILL',
    icon: '\u2615',
    bpm: 75,
    desc: 'Rain, vinyl crackle, jazzy chords',
    code: `setCps(75/60/4)

// LATE NIGHT LOFI

$: s("hh*16").bank("RolandTR808")
  .gain(slider(.025, 0, .08))
  .speed("[2.1 2.5 2.3 2.7]*2")
  .lpf(1400).hpf(700)
  .room(.6).pan(sine.range(.1,.9).slow(20))
  .delay(.18).delayfeedback(.42)
  .scope()

$kick: s("[bd ~ ~ ~] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.25).lpf(350).room(.3).shape(.15)
  .scope()

$snare: s("~ [~ cp] ~ [~ ~ cp ~]").bank("RolandTR808")
  .gain(.12).lpf(1400).room(.5)
  .delay(.08).delayfeedback(.15)
  .scope()

$rhodes: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_epiano1").velocity(slider(.12, .03, .25))
  .lpf(sine.range(900,2000).slow(32))
  .room(.55).delay(.2).delayfeedback(.32)
  .slow(2)
  .pianoroll()

$bass: note("<d2 g1 c2 a1>")
  .s("sine").gain(.2)
  .lpf(100).room(.1).slow(2)
  .pianoroll()

$pad: note("<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>")
  .s("sawtooth").gain(.015)
  .lpf(sine.range(180,500).slow(40))
  .room(.85).delay(.3).delayfeedback(.48)
  .slow(4)
  .scope()`,
  },
  {
    id: 'rave',
    label: 'RAVE',
    icon: '\uD83C\uDF08',
    bpm: 145,
    desc: 'Ravebass, chord stabs, breakbeats',
    code: `setCps(145/60/4)

// RAVE REVIVAL

$kick: s("bd*4").gain(.9).shape(.3)
  .lpf(200).scope()

$: s("~ cp ~ cp").gain(.5)
  .room(.3).delay(.08).scope()

$: s("hh*8").gain("[.2 .35]*4")
  .speed("[1 1.3 1 1.5]*2").hpf(1000)
  .scope()

$stabs: note("[c,eb,f,ab](5,16)/2")
  .s("sawtooth").clip(.95)
  .lpenv(4).room(.8)
  .lpf(1220).delay(.6)
  .rarely(add(note(12)))
  .chunk(4,add(note(12)))
  .orbit(2).fast(2).mul(gain(1.5))
  .pianoroll()

$bass: note("f1*4")
  .s("sawtooth").gain(.5)
  .struct("<x(3,8) x*2>*2")
  .shape(.5).room(.2)
  .lpf(perlin.range(500,800).slow(4))
  .lpq(slider(4, 0, 8))
  .pianoroll()`,
  },
  {
    id: 'blank',
    label: 'BLANK',
    icon: '\uD83D\uDCDD',
    bpm: 120,
    desc: 'Empty canvas - start from scratch',
    code: `setCps(120/60/4)

// YOUR SONG STARTS HERE

$: s("bd*4").scope()

`,
  },
]

// Component

interface StudioGenreSelectorProps {
  activeGenre: string
  onSelect: (id: string) => void
}

export default function StudioGenreSelector({ activeGenre, onSelect }: StudioGenreSelectorProps) {
  return (
    <div className="p-2 border-b border-white/[0.06]">
      <div className="text-[8px] font-bold uppercase tracking-[.2em] text-white/20 mb-2 px-1">START FROM</div>
      <div className="grid grid-cols-2 gap-1">
        {GENRE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`px-2 py-1.5 rounded text-[9px] font-bold tracking-wide text-left transition-all cursor-pointer ${
              activeGenre === t.id
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25'
                : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent'
            }`}
            title={t.desc}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
