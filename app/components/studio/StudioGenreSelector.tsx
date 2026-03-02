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
  .orbit(0).scope()

$bass: n("0 3 -4 2 5 -2 1 -5 3 0 -3 4 2 -1 5 -4").scale("c:minor")
  .s("sawtooth").gain(.5).lpf(200).lpenv(slider(2.28, 0, 8))
  .lpq(12).orbit(2)
  .distort(.8)
  .scope().pianoroll()

$pad: note("<c3 c3 ~ c3 ~ ~ c3 ~>")
  .s("supersaw").detune(1).rel(5).gain(.15)
  .slow(2).orbit(3)
  .room(.3)
  .scope().pianoroll()

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
  .gain(.6).orbit(1)
  .scope().pianoroll()

$: n("<0>*16").scale("g:minor").trans(-24)
  .o(4).s("supersaw")
  .lpf(100).lpenv(slider(4, 0, 9)).lps(.2).lpd(.12)
  .gain(.6).orbit(2)
  .scope().pianoroll()

$: s("bd:2!4")
  .duck(1).duckdepth(.8).duckattack(.16)
  .gain(.8).orbit(3).scope()

$: s("bd*4").gain(.9).orbit(0).scope()

$: s("~ cp ~ ~").gain(.6)
  .room(.3).delay(.15).orbit(4).scope()

$: s("hh*8").gain("[.2 .35]*4")
  .speed("[1 1.3]*4").hpf(1000).orbit(5).scope()`,
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
  .duck(1).duckdepth(.7).duckattack(.2)
  .orbit(0).scope()

$clap: s("~ cp ~ ~").bank("RolandTR909")
  .gain(.55).room(.35).delay(.08)
  .orbit(2).scope()

$hats: s("[~ hh]*4").bank("RolandTR909")
  .gain("[.3 .5 .35 .6]")
  .speed("[1 1.15 1 1.2]").hpf(800)
  .orbit(3).scope()

$bass: note("<c2 c2 a1 b1>*2").scale("C4:minor")
  .s("sawtooth").gain(.45)
  .lpf(slider(400, 80, 2000)).lpq(4).shape(.12)
  .orbit(1)
  .scope().pianoroll()

$chords: note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("gm_epiano1").gain(slider(.2, 0, .5))
  .lpf(1800).room(.4).delay(.15).delayfeedback(.3)
  .slow(2).orbit(4)
  .scope().pianoroll()`,
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
    .shape(.4).speed(.7).gain(.6)
    ,
  s("[~ hh]*4")
    .gain("[.25 .1]*4")
    .room(0.1)
    .lpf(saw.slow(8).range(8000,200))
).duck(1).duckdepth(.6).orbit(0).scope()

$bass: note("<c2 [~ c2] f1 g1>").scale("C4:minor")
  .s("sine").gain(.5)
  .lpf(180).shape(.15)
  .orbit(1)
  .scope().pianoroll()

$keys: note("<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3] [a2,c3,e3]>")
  .s("gm_epiano1").gain(.18)
  .lpf(1400).room(.5).delay(.12)
  .slow(2).orbit(2)
  .scope().pianoroll()`,
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
  .slow(4).orbit(0)
  .scope().pianoroll()

$shimmer: n("<4 3 2 1 2 3>*4").scale("C5:major")
  .s("gm_music_box").gain(.03)
  .room(.85).delay(.25).delayfeedback(.5)
  .lpf(2800).hpf(400)
  .jux(rev).off(1/8, x => x.speed(.5).gain(.02))
  .slow(2).orbit(1)
  .scope().pianoroll()

$: s("hh*8").gain(sine.range(.005,.02).slow(16))
  .speed("[2.5 2.8 2.3 2.7]*2")
  .lpf(1200).hpf(600)
  .room(.7).pan(sine.range(.2,.8).slow(12))
  .orbit(2).scope()

$rumble: s("bd:3").gain(sine.range(0,.025).slow(20))
  .speed(.2).lpf(100)
  .room(.95).slow(8)
  .orbit(3).scope()`,
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
).duck(1).duckdepth(.75).duckattack(.1).orbit(0).scope()

$bass: note("<c1 [~ c1] eb1 [f1 ~]>*2")
  .s("sawtooth").gain(.4)
  .lpf(slider(300, 60, 1500)).lpq(6)
  .shape(.25).distort(.15)
  .orbit(1)
  .scope().pianoroll()

$: n("<0 4 7 [4 0]>*2").scale("C4:minor")
  .s("gm_piano").gain(.15)
  .room(.5).delay(.2).delayfeedback(.35)
  .lpf(2000).orbit(2)
  .scope().pianoroll()`,
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
  .duck(2).duckdepth(.8)
  .orbit(0).scope()

$perc: s("[~ rim] [~ cp:3] [rim ~] [~ ~]")
  .gain(.35).room(.4)
  .speed(perlin.range(.8, 1.3).slow(4))
  .delay(.1).delayfeedback(.2)
  .orbit(1).scope()

$hats: s("hh*16").gain(perlin.range(.05,.25).slow(2))
  .speed(perlin.range(1, 2).slow(3))
  .lpf(perlin.range(2000, 6000).slow(5))
  .hpf(800).pan(sine.range(.2,.8).slow(7))
  .orbit(3).scope()

$bass: n("0 -3 2 -1 4 -2 1 -4").scale("c:minor")
  .s("sawtooth").gain(.35)
  .lpf(slider(200, 50, 800)).lpenv(3).lpq(8)
  .shape(.3).orbit(2)
  .scope().pianoroll()

$pad: note("<c3 ~ ~ c3 ~ ~ ~ ~ c3 ~ ~ ~ ~ ~ ~ ~>")
  .s("supersaw").detune(2).gain(.08)
  .room(.6).delay(.3).delayfeedback(.45)
  .lpf(perlin.range(400, 1200).slow(6))
  .slow(4).orbit(4)
  .scope().pianoroll()`,
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
  .orbit(0).scope()

$kick: s("[bd ~ ~ ~] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.25).lpf(350).room(.3).shape(.15)
  .orbit(1).scope()

$snare: s("~ [~ cp] ~ [~ ~ cp ~]").bank("RolandTR808")
  .gain(.12).lpf(1400).room(.5)
  .delay(.08).delayfeedback(.15)
  .orbit(2).scope()

$rhodes: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>").scale("D4:minor")
  .s("gm_epiano1").gain(.15)
  .lpf(sine.range(900,2000).slow(32))
  .room(.55).delay(.2).delayfeedback(.32)
  .slow(2).orbit(3)
  .scope().pianoroll()

$bass: note("<d2 g1 c2 a1>")
  .s("sine").gain(.2)
  .lpf(100).room(.1).slow(2)
  .orbit(4)
  .scope().pianoroll()

$pad: note("<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>")
  .s("sawtooth").gain(.015)
  .lpf(sine.range(180,500).slow(40))
  .room(.85).delay(.3).delayfeedback(.48)
  .slow(4).orbit(5)
  .scope().pianoroll()`,
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
  .lpf(200).orbit(0).scope()

$: s("~ cp ~ cp").gain(.5)
  .room(.3).delay(.08).orbit(1).scope()

$: s("hh*8").gain("[.2 .35]*4")
  .speed("[1 1.3 1 1.5]*2").hpf(1000)
  .orbit(2).scope()

$stabs: note("[c,eb,f,ab](5,16)/2").scale("C4:minor")
  .s("sawtooth").gain(.7).clip(.95)
  .lpenv(4).room(.8)
  .lpf(1220).delay(.6)
  .rarely(add(note(12)))
  .chunk(4,add(note(12)))
  .orbit(3).fast(2)
  .scope().pianoroll()

$bass: note("f1*4")
  .s("sawtooth").gain(.5)
  .struct("<x(3,8) x*2>*2")
  .shape(.5).room(.2)
  .lpf(perlin.range(500,800).slow(4))
  .lpq(slider(4, 0, 8))
  .orbit(4)
  .scope().pianoroll()`,
  },
  {
    id: 'birdsofafeather',
    label: 'BIRDS OF A FEATHER',
    icon: '🐦',
    bpm: 105,
    desc: 'Billie-style kalimba + guitar with arranged sections',
    code: `setcps(105/60/4)

// BIRDS OF A FEATHER (REMAKE)
// by saga_3k

let m1 =
note("<[D@3 A@2 ~ D@2] [Cs@2 ~ A@2 ~ Cs@2]>".add("12,24")).s("gm_kalimba:3").legato(1.5).fast(2)
.attack(.025).release(.2).lp(1000)
.room(".6:2").postgain(1.5)

let m2 =
note("<[D@3 A@2 ~ D@2] [Cs@2 ~ A@2 ~ Cs@2]>".add("12,24"))
.layer(
x=>x.s("gm_kalimba:3").legato(1.5).attack(.025).release(.2).lp(1000).room(".6:2").postgain(2),
x=>x.s("gm_acoustic_guitar_steel:6").clip(1.5).release(.2).room(".6:2").postgain(1)
).fast(2)

let dr =
stack( s("[bd:<1 0>(<3 1>,8,<0 2>:1.3)] , [~ sd:<15>:2.5]").note("B1").bank("LinnDrum")
.decay(.3).room(".3:2").fast(2),

s("[LinnDrum_hh(<3 2>,8)]").hp("1000").lp("9000").decay(.3).velocity([".8 .6"]).room(".3:2").fast(2),
s("sh*8").note("B1").bank("RolandTR808").room(".6:2").velocity("[.8 .5]!4").postgain(1.5).fast(2))

let chord =
n(\`<[[0,2,4,6] ~!3] ~ ~ ~
[[-1,0,2,4] ~!3] ~ ~ ~
[[1,3,5,7] ~!3]  ~ ~ ~
[[-2,0,1,3] ~!3]  ~ [[-2,-1,1,3] ~!3] ~
>\`).scale("D:major").s("gm_epiano1:6")
.decay(1.5).release(.25).lp(2500).delay(".45:.1:.3").room(".6:2")
.postgain(1.5).fast(2)

let bass1note =
n("<0 -1 1 -2>/2").scale("D1:major").s("gm_lead_8_bass_lead:1")
.lp(800).clip(.1).attack(.2).release(.12)
.delay(".45:.1:.3").room(".6:2")
.postgain(1.3)

let bassline =
note("<[D2!28 Cs2!4] B1*32 [E2!28 D2!4] A1*32>/2").s("gm_electric_bass_pick")
.decay(.5).velocity(rand.range(.7,1).fast(4))
.lp(1000).compressor("-20:20:10:.002:.02").room(".6:2")
.postgain(1.5)

let chordOrg =
n(\`<[0,2,4,6]
[-1,0,2,4]
[1,3,5,7]
[-2,0,1,3]
>/2\`).scale("D2:major").s("gm_church_organ:4")
.legato(1).delay(".45:.1:.3").room(".6:2")
.postgain(.6)

let chordArp =
n(\`<[0 2 4 6]*8
[-1 0 2 4]*8
[1 3 5 7]*8
[-2 0 1 3]*8
>/2\`).scale("D4:major").s("gm_electric_guitar_jazz:<2 3>")
.legato(.08).delay(".45:.1:.3").room(".6:2").velocity(saw.range(.8,1).fast(4))
.juxBy(1,rev())
.postgain(1.8)

$:arrange(
  [2,stack(m1,dr)],
  [8,s_polymeter(m1,dr,chord,bass1note)],
  [8,s_polymeter(m1,dr,chord,bass1note,bassline)],
  [8,s_polymeter(m2,dr,chord,bass1note,bassline,chordArp)],
  [8,s_polymeter(m2,dr,chord,bass1note,bassline,chordOrg,chordArp)],
  [4,s_polymeter(m2,dr,chord,bass1note,bassline,chordOrg,chordArp)],
  [4,s_polymeter(m2,arrange([2,dr],[2,silence]).fast(4),bass1note,bassline,chordOrg)]
  )
`,
  },
  {
    id: 'blank',
    label: 'BLANK',
    icon: '\uD83D\uDCDD',
    bpm: 120,
    desc: 'Empty canvas - start from scratch',
    code: `setCps(120/60/4)

// YOUR SONG STARTS HERE

$: s("bd*4").gain(.8).orbit(0).scope()

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
    <div className="p-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex flex-col gap-0.5">
        {GENRE_TEMPLATES.map((t) => {
          const isActive = activeGenre === t.id
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className="flex items-center gap-1.5 text-left transition-all duration-[180ms] cursor-pointer px-1.5 py-1 group rounded-xl"
              style={{
                background: isActive ? '#2a2e34' : 'transparent',
                border: 'none',
                color: isActive ? '#7fa998' : '#5a616b',
                boxShadow: isActive ? 'inset 2px 2px 4px #14161a, inset -2px -2px 4px #2c3036' : 'none',
              }}
              title={`${t.label} — ${t.desc}`}
            >
              <span className="text-[11px] leading-none">{t.icon}</span>
              <span className="text-[7px] font-black uppercase tracking-[.08em] truncate">{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
