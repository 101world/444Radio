'use client'

// Genre Templates: the PRO way to make songs
// Derived from real Strudel live-coding sessions.
// Each uses: $: / $name: blocks, stack(), .scope(),
// slider(), .trans(), .duck(), .off(), .jux(), perlin, etc.
//
// IMPORTANT: Only use methods that exist in the installed Strudel packages:
// - .scope() (NOT ._scope - underscore prefix doesn't exist)
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
  .scope()

$pad: note("<c3 c3 ~ c3 ~ ~ c3 ~>")
  .s("supersaw").detune(1).rel(5).gain(.15)
  .slow(2).orbit(3)
  .room(.3)
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
  .gain(.6).orbit(1)
  .scope()

$: n("<0>*16").scale("g:minor").trans(-24)
  .o(4).s("supersaw")
  .lpf(100).lpenv(slider(4, 0, 9)).lps(.2).lpd(.12)
  .gain(.6).orbit(2)
  .scope()

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

$bass: note("<c2 c2 a1 b1>*2").scale("C4:major")
  .s("sawtooth").gain(.45)
  .lpf(slider(400, 80, 2000)).lpq(4).shape(.12)
  .orbit(1)
  .scope()

$chords: note("<[c3,e3,g3] [c3,e3,g3] [a2,c3,e3] [b2,d3,f3]>")
  .s("gm_epiano1").gain(slider(.2, 0, .5))
  .lpf(1800).room(.4).delay(.15).delayfeedback(.3)
  .slow(2).orbit(4)
  .scope()`,
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

$bass: note("<c2 [~ c2] f1 g1>").scale("C4:major")
  .s("sine").gain(.5)
  .lpf(180).shape(.15)
  .orbit(1)
  .scope()

$keys: note("<[d3,f3,a3] [g2,b2,d3] [c3,e3,g3] [a2,c3,e3]>")
  .s("gm_epiano1").gain(.18)
  .lpf(1400).room(.5).delay(.12)
  .slow(2).orbit(2)
  .scope()`,
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
  .scope()

$shimmer: n("<4 3 2 1 2 3>*4").scale("C5:major")
  .s("gm_music_box").gain(.03)
  .room(.85).delay(.25).delayfeedback(.5)
  .lpf(2800).hpf(400)
  .jux(rev).off(1/8, x => x.speed(.5).gain(.02))
  .slow(2).orbit(1)
  .scope()

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
  .scope()

$: n("<0 4 7 [4 0]>*2").scale("C4:minor")
  .s("gm_piano").gain(.15)
  .room(.5).delay(.2).delayfeedback(.35)
  .lpf(2000).orbit(2)
  .scope()`,
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
  .scope()

$pad: note("<c3 ~ ~ c3 ~ ~ ~ ~ c3 ~ ~ ~ ~ ~ ~ ~>")
  .s("supersaw").detune(2).gain(.08)
  .room(.6).delay(.3).delayfeedback(.45)
  .lpf(perlin.range(400, 1200).slow(6))
  .slow(4).orbit(4)
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
  .orbit(0).scope()

$kick: s("[bd ~ ~ ~] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.25).lpf(350).room(.3).shape(.15)
  .orbit(1).scope()

$snare: s("~ [~ cp] ~ [~ ~ cp ~]").bank("RolandTR808")
  .gain(.12).lpf(1400).room(.5)
  .delay(.08).delayfeedback(.15)
  .orbit(2).scope()

$rhodes: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>").scale("C4:major")
  .s("gm_epiano1").gain(.15)
  .lpf(sine.range(900,2000).slow(32))
  .room(.55).delay(.2).delayfeedback(.32)
  .slow(2).orbit(3)
  .scope()

$bass: note("<d2 g1 c2 a1>")
  .s("sine").gain(.2)
  .lpf(100).room(.1).slow(2)
  .orbit(4)
  .scope()

$pad: note("<[d3,a3,f4] [g3,d4,b4] [c3,g3,e4] [a2,e3,c4]>")
  .s("sawtooth").gain(.015)
  .lpf(sine.range(180,500).slow(40))
  .room(.85).delay(.3).delayfeedback(.48)
  .slow(4).orbit(5)
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
  .scope()

$bass: note("f1*4")
  .s("sawtooth").gain(.5)
  .struct("<x(3,8) x*2>*2")
  .shape(.5).room(.2)
  .lpf(perlin.range(500,800).slow(4))
  .lpq(slider(4, 0, 8))
  .orbit(4)
  .scope()`,
  },
  {
    id: 'birdsofafeather',
    label: 'BIRDS OF A FEATHER',
    icon: 'Ã°Å¸ÂÂ¦',
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
  // ═══════════════════════════════════════════════════════
  //  NEW GENRE TEMPLATES — Uses vocals, advanced FX, pro patterns
  // ═══════════════════════════════════════════════════════
  {
    id: 'gospel',
    label: 'GOSPEL CHOIR',
    icon: '⛪',
    bpm: 88,
    desc: 'Soulful choir harmonies with organ and claps',
    code: `setCps(88/60/4)

// GOSPEL SUNDAY

$choir: note("<[c3,e3,g3,b3] [f3,a3,c4,e4] [g3,b3,d4,f4] [c3,e3,g3,c4]>")
  .s("gm_choir_aahs").gain(.35)
  .lpf(sine.range(800,2500).slow(16))
  .room(.7).delay(.15).delayfeedback(.25)
  .attack(.15).rel(2).slow(2)
  .orbit(0).scope()

$oohs: note("<[e4,g4] [a4,c5] [b4,d5] [g4,c5]>")
  .s("gm_voice_oohs").gain(.18)
  .lpf(2000).room(.8).delay(.2).delayfeedback(.3)
  .attack(.2).rel(3).pan(sine.range(.3,.7).slow(8))
  .slow(2).orbit(1).scope()

$organ: note("<[c2,e2,g2,c3] [f2,a2,c3,f3] [g2,b2,d3,g3] [c2,e2,g2,c3]>")
  .s("gm_church_organ").gain(.22)
  .lpf(1200).room(.5).slow(2)
  .orbit(2).scope()

$kick: s("[bd ~ ~ ~] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.7).lpf(300).shape(.1)
  .orbit(3).scope()

$clap: s("~ [cp ~ cp] ~ [cp ~ ~ cp]").bank("RolandTR808")
  .gain(.4).room(.5).delay(.1)
  .orbit(4).scope()

$bass: note("<c2 f1 g1 c2>")
  .s("gm_electric_bass_finger").gain(.35)
  .lpf(400).shape(.08).slow(2)
  .orbit(5).scope()
`,
  },
  {
    id: 'synthwave',
    label: 'SYNTHWAVE',
    icon: '🌆',
    bpm: 118,
    desc: '80s retro synths with gated reverb and arps',
    code: `setCps(118/60/4)

// MIDNIGHT DRIVE

$lead: n("<0 4 7 11 12 11 7 4>*2").scale("A4:minor")
  .s("supersaw").gain(.25)
  .lpf(sine.range(600,3000).slow(8)).lpq(4)
  .room(.6).delay(.25).delayfeedback(.4)
  .detune(2).orbit(0).scope()

$pad: note("<[a2,c3,e3] [f2,a2,c3] [g2,b2,d3] [e2,g2,b2]>")
  .s("gm_pad_warm").gain(.2)
  .lpf(perlin.range(400,1800).slow(12))
  .room(.85).attack(.3).rel(4)
  .slow(2).orbit(1).scope()

$synchoir: note("<[a3,e4] [c4,g4] [d4,a4] [e4,b4]>")
  .s("gm_synth_choir").gain(.1)
  .lpf(1500).room(.7).delay(.3).delayfeedback(.45)
  .attack(.25).rel(3).slow(4)
  .orbit(2).scope()

$kick: s("bd*4").gain(.85)
  .shape(.25).lpf(250)
  .duck(2).duckdepth(.7).duckattack(.15)
  .orbit(3).scope()

$snare: s("~ sd ~ sd").bank("RolandTR909")
  .gain(.55).room(.6).delay(.08)
  .orbit(4).scope()

$hats: s("hh*8").gain("[.15 .3]*4")
  .speed("[1 1.2 1 1.4]*2").hpf(1000)
  .orbit(5).scope()

$bass: n("<0 0 -3 -5>*4").scale("A1:minor")
  .s("gm_synth_bass_1").gain(.4)
  .lpf(slider(500, 80, 2000)).lpq(6)
  .shape(.2).orbit(6).scope()
`,
  },
  {
    id: 'trap',
    label: 'TRAP',
    icon: '💎',
    bpm: 145,
    desc: 'Hard 808s, rolling hats, dark melodies',
    code: `setCps(145/60/4)

// TRAP SEASON

$kick: s("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ [~ bd]")
  .bank("RolandTR808").gain(.9)
  .shape(.4).lpf(200)
  .orbit(0).scope()

$hihat: s("hh*16").bank("RolandTR808")
  .gain("[.15 .1 .2 .1 .15 .1 .25 .1]*2")
  .speed("[1 1.2 1 1.5 1 1.3 1 1.8]*2")
  .hpf(1200).orbit(1).scope()

$oh: s("[~ ~ ~ ~] [~ ~ oh ~] [~ ~ ~ ~] [~ oh ~ ~]")
  .bank("RolandTR808").gain(.25)
  .hpf(800).orbit(2).scope()

$clap: s("~ cp ~ ~").bank("RolandTR808")
  .gain(.5).room(.3).delay(.06)
  .orbit(3).scope()

$bass: note("<a0 ~ ~ a0 ~ ~ a0 ~ a0 ~ ~ ~ a0 ~ ~ [~ a0]>")
  .s("sine").gain(.55)
  .lpf(120).shape(.3).rel(.8)
  .orbit(4).scope()

$melody: n("<0 ~ 7 ~ 5 ~ 3 ~ 0 ~ 7 ~ [10 7] ~ 3 ~>").scale("A3:minor")
  .s("gm_music_box").gain(.15)
  .lpf(2500).room(.4).delay(.2).delayfeedback(.35)
  .orbit(5).scope()

$vox: note("<[a3,c4,e4] ~ ~ ~ [g3,b3,d4] ~ ~ ~>")
  .s("gm_voice_oohs").gain(.08)
  .lpf(1800).room(.6).delay(.25).delayfeedback(.4)
  .attack(.15).rel(2).slow(2)
  .orbit(6).scope()
`,
  },
  {
    id: 'jazz',
    label: 'JAZZY KEYS',
    icon: '🎷',
    bpm: 96,
    desc: 'Walking bass, Rhodes, sax with swing feel',
    code: `setCps(96/60/4)

// SMOKY JAZZ CLUB

$rhodes: note("<[d3,f3,a3,c4] [g2,b2,d3,f3] [c3,e3,g3,b3] [a2,c3,e3,g3]>")
  .s("gm_epiano1").gain(.25)
  .lpf(sine.range(1200,2800).slow(16))
  .room(.45).delay(.15).delayfeedback(.25)
  .slow(2).orbit(0).scope()

$sax: n("<0 2 4 5 7 5 4 2>").scale("D4:dorian")
  .s("gm_tenor_sax").gain(.18)
  .lpf(2200).room(.35).delay(.1)
  .attack(.05).rel(.8)
  .orbit(1).scope()

$bass: note("<d2 [~ d2] g1 [~ g1] c2 [~ c2] a1 [~ a1]>")
  .s("gm_acoustic_bass").gain(.35)
  .lpf(600).shape(.05).room(.15)
  .orbit(2).scope()

$kick: s("[bd ~ ~ bd] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.45).lpf(350).room(.2)
  .orbit(3).scope()

$ride: s("ride*8").gain("[.1 .15 .12 .18]*2")
  .speed("[1 1.05]*4").hpf(1500)
  .pan(sine.range(.3,.7).slow(6))
  .orbit(4).scope()

$brush: s("~ [sd:3 ~] ~ [~ sd:3]").bank("RolandTR808")
  .gain(.15).lpf(1800).room(.3)
  .orbit(5).scope()
`,
  },
  {
    id: 'reggaeton',
    label: 'REGGAETON',
    icon: '🔊',
    bpm: 95,
    desc: 'Dembow rhythm with brass and vocal chops',
    code: `setCps(95/60/4)

// DEMBOW HEAT

$kick: s("bd ~ ~ bd ~ ~ bd ~").bank("RolandTR808")
  .gain(.85).shape(.3).lpf(200)
  .orbit(0).scope()

$snare: s("~ ~ sd ~ ~ sd ~ [sd ~]").bank("RolandTR909")
  .gain(.55).room(.2)
  .orbit(1).scope()

$dembow: s("[~ rim] [~ rim] [~ rim] [~ rim]").bank("RolandTR808")
  .gain(.35).room(.15).speed(1.1)
  .orbit(2).scope()

$hats: s("oh*8").bank("RolandTR808")
  .gain("[.1 .2 .1 .15]*2")
  .speed("[1 1.5]*4").hpf(1200)
  .orbit(3).scope()

$brass: note("<[g3,bb3,d4] [f3,a3,c4] [eb3,g3,bb3] [f3,a3,c4]>")
  .s("gm_brass_section").gain(.2)
  .lpf(1600).attack(.05).rel(.5)
  .room(.25).slow(2)
  .orbit(4).scope()

$voxchop: note("<g4 ~ bb4 ~ a4 ~ g4 ~>")
  .s("gm_choir_aahs").gain(.12)
  .lpf(2000).chop(4).room(.3)
  .delay(.12).delayfeedback(.2)
  .orbit(5).scope()

$bass: note("<g1 ~ ~ g1 f1 ~ ~ f1>")
  .s("sine").gain(.5)
  .lpf(150).shape(.2).rel(.6)
  .orbit(6).scope()
`,
  },
  {
    id: 'edm',
    label: 'EDM / BIG ROOM',
    icon: '🎆',
    bpm: 128,
    desc: 'Festival drops with supersaw builds and vocal stabs',
    code: `setCps(128/60/4)

// FESTIVAL MAIN STAGE

$kick: s("bd*4").gain(.9)
  .shape(.25).lpf(250)
  .duck(2).duckdepth(.85).duckattack(.15)
  .orbit(0).scope()

$clap: s("~ cp ~ cp").bank("RolandTR909")
  .gain(.5).room(.4).delay(.06)
  .orbit(1).scope()

$drop: n("<0 0 3 5 0 0 7 5>*2").scale("E3:minor")
  .s("supersaw").gain(.55)
  .lpf(slider(1500, 200, 4000)).lpq(3)
  .detune(3).room(.3)
  .duck(0).duckdepth(.7).duckattack(.1)
  .orbit(2).scope()

$voxstab: note("<[e4,g4,b4] ~ ~ ~ [d4,g4,b4] ~ ~ ~>")
  .s("gm_synth_choir").gain(.2)
  .lpf(3000).room(.5).chop(8)
  .delay(.15).delayfeedback(.3)
  .orbit(3).scope()

$hats: s("hh*16").gain(perlin.range(.08,.22).slow(2))
  .speed("[1 1.3 1 1.5]*4").hpf(1200)
  .orbit(4).scope()

$bass: n("<0 0 3 5>*2").scale("E1:minor")
  .s("sawtooth").gain(.4)
  .lpf(300).shape(.35).lpq(4)
  .duck(0).duckdepth(.6).duckattack(.1)
  .orbit(5).scope()

$riser: note("e3")
  .s("gm_pad_sweep").gain(sine.range(0,.12).slow(32))
  .lpf(sine.range(200,4000).slow(32))
  .room(.7).slow(8)
  .orbit(6).scope()
`,
  },
  {
    id: 'afrobeat',
    label: 'AFROBEATS',
    icon: '🌍',
    bpm: 108,
    desc: 'Afrobeat grooves with kalimba and percussion',
    code: `setCps(108/60/4)

// AFRO GROOVE

$kick: s("[bd ~ bd ~] [~ bd ~ bd]").bank("RolandTR808")
  .gain(.75).lpf(300).shape(.15)
  .orbit(0).scope()

$snare: s("~ [sd ~] ~ [~ sd]").bank("RolandTR909")
  .gain(.45).room(.25).delay(.05)
  .orbit(1).scope()

$perc: s("[rim cp] [~ rim] [cp ~] [rim ~]").bank("RolandTR808")
  .gain(.3).room(.2).speed("[1 1.15]*2")
  .orbit(2).scope()

$shaker: s("hh*16").gain("[.08 .15 .1 .18]*4")
  .speed("[2 2.3 2 2.5]*4").hpf(2000)
  .orbit(3).scope()

$kalimba: n("<0 2 4 7 9 7 4 2>*2").scale("G4:major")
  .s("gm_kalimba").gain(.2)
  .room(.5).delay(.2).delayfeedback(.35)
  .lpf(3500).orbit(4).scope()

$choir: note("<[g3,b3,d4] [c4,e4,g4] [d4,f4,a4] [c4,e4,g4]>")
  .s("gm_choir_aahs").gain(.12)
  .lpf(1800).room(.5).attack(.1).rel(2)
  .slow(2).orbit(5).scope()

$bass: note("<g1 [~ g1] c2 [~ c2] d2 [~ d2] c2 [~ c2]>")
  .s("gm_synth_bass_1").gain(.35)
  .lpf(500).shape(.1).orbit(6).scope()

$guitar: n("<0 4 7 4>*4").scale("G3:major")
  .s("gm_electric_guitar_clean").gain(.12)
  .lpf(2000).room(.3).delay(.1)
  .orbit(7).scope()
`,
  },
  {
    id: 'cinematic',
    label: 'CINEMATIC',
    icon: '🎬',
    bpm: 65,
    desc: 'Epic strings, choir, and thunderous percussion',
    code: `setCps(65/60/4)

// EPIC CINEMATIC

$strings: note("<[d2,a2,d3,f3] [c2,g2,c3,e3] [bb1,f2,bb2,d3] [a1,e2,a2,c3]>")
  .s("gm_string_ensemble_1").gain(.3)
  .lpf(perlin.range(600,2500).slow(16))
  .room(.8).attack(.4).rel(4)
  .slow(4).orbit(0).scope()

$choir: note("<[d3,f3,a3] [c3,e3,g3] [bb2,d3,f3] [a2,c3,e3]>")
  .s("gm_choir_aahs").gain(.2)
  .lpf(1800).room(.85).delay(.2).delayfeedback(.3)
  .attack(.3).rel(3).slow(4)
  .orbit(1).scope()

$voxhigh: note("<a4 g4 f4 e4>")
  .s("gm_voice_oohs").gain(.1)
  .lpf(2500).room(.9).delay(.3).delayfeedback(.45)
  .attack(.5).rel(4).slow(8)
  .orbit(2).scope()

$horn: note("<d3 c3 bb2 a2>")
  .s("gm_french_horn").gain(.15)
  .lpf(1400).room(.6).attack(.2).rel(2)
  .slow(4).orbit(3).scope()

$timpani: s("[bd:5 ~ ~ ~] ~ [~ bd:5] ~")
  .gain(.45).speed(.5).lpf(250).room(.6)
  .slow(2).orbit(4).scope()

$cymbal: s("~ ~ ~ [crash ~]")
  .gain(sine.range(.05,.2).slow(16))
  .room(.7).hpf(600).slow(4)
  .orbit(5).scope()

$cello: note("<d2 c2 bb1 a1>")
  .s("gm_cello").gain(.2)
  .lpf(800).room(.5).attack(.1).rel(3)
  .slow(4).orbit(6).scope()
`,
  },
  {
    id: 'phonk',
    label: 'PHONK',
    icon: '👹',
    bpm: 140,
    desc: 'Dark Memphis beats with cowbell and distorted choir',
    code: `setCps(140/60/4)

// DRIFT PHONK

$kick: s("bd*4").bank("RolandTR808")
  .gain(.9).shape(.4).lpf(200)
  .orbit(0).scope()

$clap: s("~ cp ~ cp").bank("RolandTR808")
  .gain(.5).room(.25)
  .orbit(1).scope()

$cowbell: s("~ [rim rim] ~ [rim ~ rim ~]").bank("RolandTR808")
  .gain(.3).speed(1.8).hpf(2000)
  .delay(.08).delayfeedback(.15)
  .orbit(2).scope()

$hats: s("oh*8").bank("RolandTR808")
  .gain("[.1 .2 .15 .25]*2")
  .speed("[1.5 1.8]*4").hpf(1500)
  .orbit(3).scope()

$darkchoir: note("<[a2,c3,e3] ~ [g2,b2,d3] ~>")
  .s("gm_choir_aahs").gain(.2)
  .lpf(800).distort(.4).crush(12)
  .room(.5).delay(.2).delayfeedback(.3)
  .slow(2).orbit(4).scope()

$bass: note("<a0 ~ a0 ~ a0 ~ a0 [a0 g0]>")
  .s("sine").gain(.5)
  .lpf(100).shape(.5).rel(.5)
  .orbit(5).scope()

$melody: n("<0 3 5 7 8 7 5 3>").scale("A3:phrygian")
  .s("gm_music_box").gain(.12)
  .lpf(1600).crush(10).room(.3)
  .delay(.15).delayfeedback(.25)
  .orbit(6).scope()
`,
  },
  {
    id: 'rnb',
    label: 'R&B',
    icon: '💜',
    bpm: 80,
    desc: 'Smooth R&B with vocal pads and neo-soul keys',
    code: `setCps(80/60/4)

// SMOOTH R&B

$rhodes: note("<[e3,g3,b3,d4] [a2,c3,e3,g3] [d3,f3,a3,c4] [g2,b2,d3,f3]>")
  .s("gm_epiano1").gain(.22)
  .lpf(sine.range(1000,2200).slow(16))
  .room(.5).delay(.15).delayfeedback(.3)
  .slow(2).orbit(0).scope()

$voxpad: note("<[e3,b3] [a3,e4] [d4,a4] [g3,d4]>")
  .s("gm_voice_oohs").gain(.12)
  .lpf(1600).room(.7).delay(.25).delayfeedback(.4)
  .attack(.2).rel(3).slow(4)
  .pan(sine.range(.3,.7).slow(10))
  .orbit(1).scope()

$choir: note("<[e4,g4] [c4,e4] [d4,f4] [b3,d4]>")
  .s("gm_synth_choir").gain(.08)
  .lpf(2000).room(.6).attack(.15).rel(2)
  .slow(4).orbit(2).scope()

$kick: s("[bd ~ ~ ~] ~ [~ bd] ~").bank("RolandTR808")
  .gain(.55).lpf(350).shape(.08)
  .orbit(3).scope()

$snare: s("~ [~ sd] ~ [~ ~ sd ~]").bank("RolandTR808")
  .gain(.3).room(.35).lpf(2000)
  .orbit(4).scope()

$hats: s("hh*16").gain("[.05 .12 .08 .15]*4")
  .speed("[1.5 1.8 1.5 2]*4").hpf(1500)
  .orbit(5).scope()

$bass: note("<e1 a1 d2 g1>")
  .s("gm_electric_bass_finger").gain(.3)
  .lpf(500).shape(.05).room(.1)
  .slow(2).orbit(6).scope()
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
                background: isActive ? '#16181d' : 'transparent',
                border: 'none',
                color: isActive ? '#7fa998' : '#5a616b',
                boxShadow: isActive ? 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22' : 'none',
              }}
              title={`${t.label} Ã¢â‚¬â€ ${t.desc}`}
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
