'use client'

import { useState, useCallback, useRef } from 'react'
import { ChevronDown, ChevronRight, Copy, Check, Search, Volume2 } from 'lucide-react'
import StudioKnob from './StudioKnob'

// ─── Sound/instrument/sample data for quick swap ───

export const SOUND_BANKS: {
  label: string
  icon: string
  section: 'instrument' | 'sound' | 'bank'
  items: { code: string; desc: string }[]
}[] = [
  // ──────────────── SYNTHS & OSCILLATORS ────────────────
  {
    label: 'Synth Waveforms',
    icon: '🔻',
    section: 'instrument',
    items: [
      { code: 's("sawtooth")', desc: 'Classic saw — leads, bass, pads' },
      { code: 's("supersaw")', desc: 'Detuned saw — trance, rave' },
      { code: 's("sine")', desc: 'Pure sine — sub bass, bells' },
      { code: 's("square")', desc: 'Square — chiptune, leads' },
      { code: 's("triangle")', desc: 'Triangle — soft leads, bass' },
      { code: 's("pulse")', desc: 'Pulse — PWM synth' },
      { code: 's("sbd")', desc: 'Synth bass drum — 808-style' },
    ],
  },
  {
    label: 'Noise Generators',
    icon: '📡',
    section: 'instrument',
    items: [
      { code: 's("white")', desc: 'White noise — full spectrum' },
      { code: 's("pink")', desc: 'Pink noise — warm, natural' },
      { code: 's("brown")', desc: 'Brown noise — deep rumble' },
      { code: 's("crackle")', desc: 'Crackle — vinyl/fire texture' },
      { code: 's("noise")', desc: 'Noise sample' },
      { code: 's("noise2")', desc: 'Noise variants (:0-:7)' },
    ],
  },
  // ──────────────── DRUM MACHINES (71 banks) ────────────────
  {
    label: 'Roland Machines',
    icon: 'ðŸ¥',
    section: 'bank',
    items: [
      { code: '.bank("RolandTR808")', desc: 'TR-808 — hip-hop, trap' },
      { code: '.bank("RolandTR909")', desc: 'TR-909 — house, techno' },
      { code: '.bank("RolandTR707")', desc: 'TR-707 — 80s pop, electro' },
      { code: '.bank("RolandTR606")', desc: 'TR-606 — acid, minimal' },
      { code: '.bank("RolandTR626")', desc: 'TR-626 — digital 80s' },
      { code: '.bank("RolandTR505")', desc: 'TR-505 — budget classic' },
      { code: '.bank("RolandTR727")', desc: 'TR-727 — latin perc' },
      { code: '.bank("RolandCompurhythm78")', desc: 'CR-78 — vintage analog' },
      { code: '.bank("RolandCompurhythm1000")', desc: 'CR-1000 — analog perc' },
      { code: '.bank("RolandCompurhythm8000")', desc: 'CR-8000 — disco, 80s' },
      { code: '.bank("RolandR8")', desc: 'R-8 — pro session drums' },
      { code: '.bank("RolandD110")', desc: 'D-110 — LA synthesis' },
      { code: '.bank("RolandD70")', desc: 'D-70 — SuperLA percussion' },
      { code: '.bank("RolandDDR30")', desc: 'DDR-30 — compact analog' },
      { code: '.bank("RolandJD990")', desc: 'JD-990 — digital flagship' },
      { code: '.bank("RolandMC202")', desc: 'MC-202 — SH-101 family' },
      { code: '.bank("RolandMC303")', desc: 'MC-303 — groovebox' },
      { code: '.bank("RolandMT32")', desc: 'MT-32 — MIDI module' },
      { code: '.bank("RolandS50")', desc: 'S-50 — 12-bit sampler' },
      { code: '.bank("RolandSH09")', desc: 'SH-09 — monosynth kick' },
      { code: '.bank("RolandSystem100")', desc: 'System-100 — modular' },
    ],
  },
  {
    label: 'Korg Machines',
    icon: '🎛ï¸',
    section: 'bank',
    items: [
      { code: '.bank("KorgDDM110")', desc: 'DDM-110 — SuperDrums' },
      { code: '.bank("KorgKPR77")', desc: 'KPR-77 — analog budget' },
      { code: '.bank("KorgKR55")', desc: 'KR-55 — preset rhythms' },
      { code: '.bank("KorgKRZ")', desc: 'KR-Z — digital budget' },
      { code: '.bank("KorgM1")', desc: 'M1 — iconic workstation' },
      { code: '.bank("KorgMinipops")', desc: 'Minipops — vintage preset' },
      { code: '.bank("KorgPoly800")', desc: 'Poly-800 — lo-fi synth' },
      { code: '.bank("KorgT3")', desc: 'T3 — workstation drums' },
    ],
  },
  {
    label: 'Linn & Akai',
    icon: '🎚ï¸',
    section: 'bank',
    items: [
      { code: '.bank("AkaiLinn")', desc: 'Akai/Linn — 80s classic' },
      { code: '.bank("AkaiMPC60")', desc: 'MPC60 — golden hip-hop' },
      { code: '.bank("AkaiXR10")', desc: 'XR-10 — digital perc' },
      { code: '.bank("Linn9000")', desc: 'Linn 9000 — flagship' },
      { code: '.bank("LinnDrum")', desc: 'LinnDrum — Prince, 80s' },
      { code: '.bank("LinnLM1")', desc: 'LM-1 — first-ever sampled' },
      { code: '.bank("LinnLM2")', desc: 'LM-2 — cheaper LinnDrum' },
      { code: '.bank("MPC1000")', desc: 'MPC1000 — modern hip-hop' },
    ],
  },
  {
    label: 'Boss & Yamaha',
    icon: '🔊',
    section: 'bank',
    items: [
      { code: '.bank("BossDR110")', desc: 'DR-110 — Dr. Rhythm' },
      { code: '.bank("BossDR220")', desc: 'DR-220 — 80s digital' },
      { code: '.bank("BossDR55")', desc: 'DR-55 — Dr. Rhythm mkI' },
      { code: '.bank("BossDR550")', desc: 'DR-550 — Dr. Rhythm pro' },
      { code: '.bank("YamahaRM50")', desc: 'RM50 — pro module' },
      { code: '.bank("YamahaRX21")', desc: 'RX21 — FM digital' },
      { code: '.bank("YamahaRX5")', desc: 'RX5 — flagship digital' },
      { code: '.bank("YamahaRY30")', desc: 'RY30 — waveshaping' },
      { code: '.bank("YamahaTG33")', desc: 'TG33 — vector synthesis' },
    ],
  },
  {
    label: 'Emu & Oberheim',
    icon: '🔈',
    section: 'bank',
    items: [
      { code: '.bank("EmuDrumulator")', desc: 'Drumulator — budget 80s' },
      { code: '.bank("EmuModular")', desc: 'Emu Modular — modular perc' },
      { code: '.bank("EmuSP12")', desc: 'SP-12 — hip-hop legend' },
      { code: '.bank("OberheimDMX")', desc: 'DMX — electro, hip-hop' },
    ],
  },
  {
    label: 'More Machines',
    icon: '🎵',
    section: 'bank',
    items: [
      { code: '.bank("AJKPercusyn")', desc: 'Percusyn — analog perc' },
      { code: '.bank("AlesisHR16")', desc: 'HR-16 — 16-bit digital' },
      { code: '.bank("AlesisSR16")', desc: 'SR-16 — legendary preset' },
      { code: '.bank("CasioRZ1")', desc: 'RZ-1 — sampling drum' },
      { code: '.bank("CasioSK1")', desc: 'SK-1 — lo-fi sampling' },
      { code: '.bank("CasioVL1")', desc: 'VL-1 — toy keyboard' },
      { code: '.bank("DoepferMS404")', desc: 'MS-404 — analog synth' },
      { code: '.bank("MFB512")', desc: 'MFB-512 — analog berlin' },
      { code: '.bank("MoogConcertMateMG1")', desc: 'MG-1 — Moog budget' },
      { code: '.bank("RhodesPolaris")', desc: 'Polaris — digital analog' },
      { code: '.bank("RhythmAce")', desc: 'Rhythm Ace — retro preset' },
      { code: '.bank("SakataDPM48")', desc: 'DPM-48 — rare digital' },
      { code: '.bank("SequentialCircuitsDrumtracks")', desc: 'Drumtraks — SCI classic' },
      { code: '.bank("SequentialCircuitsTom")', desc: 'Tom — SCI companion' },
      { code: '.bank("SergeModular")', desc: 'Serge — modular perc' },
      { code: '.bank("SimmonsSDS400")', desc: 'SDS-400 — electronic toms' },
      { code: '.bank("SimmonsSDS5")', desc: 'SDS-5 — iconic hex pads' },
      { code: '.bank("SoundmastersR88")', desc: 'SR-88 — analog rhythm' },
      { code: '.bank("UnivoxMicroRhythmer12")', desc: 'MicroRhythmer — vintage' },
      { code: '.bank("ViscoSpaceDrum")', desc: 'Space Drum — sci-fi perc' },
      { code: '.bank("XdrumLM8953")', desc: 'LM8953 — rack module' },
    ],
  },
  // ──────────────── DRUM SAMPLES (dirt-samples) ────────────────
  {
    label: 'Kicks',
    icon: '🦶',
    section: 'sound',
    items: [
      { code: 's("bd")', desc: 'Kick drum (:0-:23) — 24 flavors' },
      { code: 's("hardkick")', desc: 'Hard kicks (:0-:5) — punchy' },
      { code: 's("clubkick")', desc: 'Club kicks (:0-:4) — big room' },
      { code: 's("popkick")', desc: 'Pop kicks (:0-:9) — clean' },
      { code: 's("reverbkick")', desc: 'Reverb kick — boomy' },
      { code: 's("kicklinn")', desc: 'Linn kick — vintage' },
      { code: 's("gabba")', desc: 'Gabba kick (:0-:3) — hardcore' },
      { code: 's("gabbaloud")', desc: 'Gabba loud (:0-:3)' },
      { code: 's("gabbalouder")', desc: 'Gabba loudest (:0-:3)' },
    ],
  },
  {
    label: 'Snares & Claps',
    icon: '💥',
    section: 'sound',
    items: [
      { code: 's("sd")', desc: 'Snare drum (:0-:1)' },
      { code: 's("sn")', desc: 'Snare collection (:0-:51) — 52 snares!' },
      { code: 's("cp")', desc: 'Clap (:0-:1)' },
      { code: 's("realclaps")', desc: 'Real claps (:0-:3) — organic' },
      { code: 's("rim")', desc: 'Rimshot' },
    ],
  },
  {
    label: 'Hats & Cymbals',
    icon: '🔔',
    section: 'sound',
    items: [
      { code: 's("hh")', desc: 'Hi-hat (:0-:12) — 13 hats' },
      { code: 's("hh27")', desc: 'Alt hi-hats (:0-:12)' },
      { code: 's("hc")', desc: 'Closed hat (:0-:5)' },
      { code: 's("ho")', desc: 'Open hat (:0-:5)' },
      { code: 's("oh")', desc: 'Open hi-hat' },
      { code: 's("linnhats")', desc: 'Linn hats (:0-:5) — vintage' },
      { code: 's("cr")', desc: 'Crash cymbal (:0-:5)' },
      { code: 's("ride")', desc: 'Ride cymbal' },
    ],
  },
  {
    label: 'Toms & Perc',
    icon: '🪘',
    section: 'sound',
    items: [
      { code: 's("ht")', desc: 'High tom (:0-:15) — 16 toms' },
      { code: 's("mt")', desc: 'Mid tom (:0-:15) — 16 toms' },
      { code: 's("lt")', desc: 'Low tom (:0-:15) — 16 toms' },
      { code: 's("perc")', desc: 'Percussion (:0-:5)' },
      { code: 's("hand")', desc: 'Hand perc (:0-:16) — 17 hits' },
      { code: 's("stomp")', desc: 'Stomps (:0-:9) — 10 stomps' },
      { code: 's("cb")', desc: 'Cowbell' },
      { code: 's("click")', desc: 'Clicks (:0-:3)' },
      { code: 's("clak")', desc: 'Clak (:0-:1)' },
      { code: 's("tok")', desc: 'Tok (:0-:3)' },
      { code: 's("tink")', desc: 'Tink (:0-:4)' },
      { code: 's("mouth")', desc: 'Mouth perc (:0-:14) — vocal' },
      { code: 's("tabla")', desc: 'Tabla (:0-:25) — 26 strokes' },
      { code: 's("tabla2")', desc: 'Tabla 2 (:0-:45) — 46 strokes!' },
      { code: 's("conga")', desc: 'Conga' },
      { code: 's("east")', desc: 'East (:0-:8) — Japanese perc' },
    ],
  },
  {
    label: 'Full Drum Kits',
    icon: '🎪',
    section: 'sound',
    items: [
      { code: 's("gretsch")', desc: 'Gretsch kit (:0-:23) — acoustic' },
      { code: 's("jazz")', desc: 'Jazz kit — brush/ride' },
      { code: 's("drumtraks")', desc: 'Drumtraks (:0-:12) — SCI' },
      { code: 's("electro1")', desc: 'Electro kit (:0-:12)' },
    ],
  },
  // ──────────────── BREAKBEATS ────────────────
  {
    label: 'Breaks & Loops',
    icon: 'ðŸ”',
    section: 'sound',
    items: [
      { code: 's("amencutup")', desc: 'Amen break cuts (:0-:31) — 32 chops' },
      { code: 's("jungle")', desc: 'Jungle breaks (:0-:12) — 13 loops' },
      { code: 's("breaks125")', desc: 'Break 125bpm (:0-:1)' },
      { code: 's("breaks152")', desc: 'Break 152bpm' },
      { code: 's("breaks157")', desc: 'Break 157bpm' },
      { code: 's("breaks165")', desc: 'Break 165bpm' },
    ],
  },
  // ──────────────── BASS & SYNTH SAMPLES ────────────────
  {
    label: 'Bass Samples',
    icon: '🔉',
    section: 'sound',
    items: [
      { code: 's("bass")', desc: 'Bass (:0-:3)' },
      { code: 's("bass1")', desc: 'Bass 1 (:0-:29) — 30 basses!' },
      { code: 's("bass2")', desc: 'Bass 2 (:0-:4)' },
      { code: 's("bass3")', desc: 'Bass 3 (:0-:10)' },
      { code: 's("bassdm")', desc: 'DM Bass (:0-:23) — 24 hits' },
      { code: 's("jungbass")', desc: 'Jungle bass (:0-:19) — 20 basses' },
    ],
  },
  {
    label: 'Synth Bass & Keys',
    icon: '🎹',
    section: 'instrument',
    items: [
      { code: 's("jvbass")', desc: 'JV bass (:0-:12) — Roland JV' },
      { code: 's("hoover")', desc: 'Hoover bass (:0-:5) — rave classic' },
      { code: 's("moog")', desc: 'Moog synth (:0-:6) — analog' },
      { code: 's("juno")', desc: 'Juno synth (:0-:11) — pads/bass' },
      { code: 's("casio")', desc: 'Casio — lo-fi keys' },
    ],
  },
  {
    label: 'Melodic Samples',
    icon: '🎶',
    section: 'instrument',
    items: [
      { code: 's("pluck")', desc: 'Plucked (:0-:16) — 17 plucks' },
      { code: 's("arpy")', desc: 'Arp patterns (:0-:10) — cascading' },
      { code: 's("stab")', desc: 'Stabs (:0-:22) — 23 stabs' },
      { code: 's("piano")', desc: 'Sampled piano — all notes' },
      { code: 's("sitar")', desc: 'Sitar (:0-:7)' },
      { code: 's("sax")', desc: 'Saxophone (:0-:21) — 22 samples' },
    ],
  },
  // ──────────────── RAVE & ELECTRONIC ────────────────
  {
    label: 'Rave & Electronic',
    icon: '⚡',
    section: 'sound',
    items: [
      { code: 's("rave")', desc: 'Rave samples (:0-:7)' },
      { code: 's("rave2")', desc: 'More rave (:0-:3)' },
      { code: 's("hardcore")', desc: 'Hardcore (:0-:11) — 12 hits' },
      { code: 's("techno")', desc: 'Techno hits (:0-:6)' },
      { code: 's("tech")', desc: 'Tech (:0-:12) — 13 hits' },
      { code: 's("future")', desc: 'Future sounds (:0-:16) — 17 hits' },
      { code: 's("industrial")', desc: 'Industrial (:0-:31) — 32 hits!' },
      { code: 's("metal")', desc: 'Metal hits (:0-:9)' },
    ],
  },
  // ──────────────── AMBIENT & NATURE ────────────────
  {
    label: 'Ambient & Nature',
    icon: '🌿',
    section: 'sound',
    items: [
      { code: 's("space")', desc: 'Space sounds (:0-:17)' },
      { code: 's("birds")', desc: 'Birds (:0-:9)' },
      { code: 's("birds3")', desc: 'More birds (:0-:18) — 19 calls' },
      { code: 's("wind")', desc: 'Wind (:0-:9) — ambience' },
      { code: 's("fire")', desc: 'Fire — crackle' },
    ],
  },
  // ──────────────── WAVETABLES ────────────────
  {
    label: 'Wavetable Banks',
    icon: '🌀',
    section: 'bank',
    items: [
      { code: '.bank("wt_digital")', desc: 'Digital wavetable' },
      { code: '.bank("wt_digital_bad_day")', desc: 'Bad Day wavetable' },
      { code: '.bank("wt_digital_basique")', desc: 'Basique wavetable' },
      { code: '.bank("wt_digital_crickets")', desc: 'Crickets wavetable' },
      { code: '.bank("wt_digital_curses")', desc: 'Curses wavetable' },
      { code: '.bank("wt_digital_echoes")', desc: 'Echoes wavetable' },
      { code: '.bank("wt_vgame")', desc: 'Video game wavetable' },
    ],
  },
  // ──────────────── MRIDANGAM ────────────────
  {
    label: 'Mridangam (Tabla)',
    icon: '🪘',
    section: 'instrument',
    items: [
      { code: 's("mridangam_thom")', desc: 'Thom — deep bass stroke' },
      { code: 's("mridangam_dhi")', desc: 'Dhi — resonant' },
      { code: 's("mridangam_dhin")', desc: 'Dhin — full tone' },
      { code: 's("mridangam_dhum")', desc: 'Dhum — muted bass' },
      { code: 's("mridangam_ta")', desc: 'Ta — sharp treble' },
      { code: 's("mridangam_tha")', desc: 'Tha — soft treble' },
      { code: 's("mridangam_na")', desc: 'Na — ring stroke' },
      { code: 's("mridangam_nam")', desc: 'Nam — closed ring' },
      { code: 's("mridangam_ka")', desc: 'Ka — muted edge' },
      { code: 's("mridangam_ki")', desc: 'Ki — sharp edge' },
      { code: 's("mridangam_gumki")', desc: 'Gumki — pitch bend' },
      { code: 's("mridangam_chaapu")', desc: 'Chaapu — slap' },
      { code: 's("mridangam_ardha")', desc: 'Ardha — half stroke' },
    ],
  },
  // ──────────────── VCSL ORCHESTRAL ────────────────
  {
    label: 'VCSL Percussion',
    icon: '🎼',
    section: 'instrument',
    items: [
      { code: 's("glockenspiel")', desc: 'VCSL Glockenspiel' },
      { code: 's("xylophone_hard_ff")', desc: 'Xylophone hard loud' },
      { code: 's("xylophone_soft_ff")', desc: 'Xylophone soft loud' },
      { code: 's("vibraphone")', desc: 'VCSL Vibraphone' },
      { code: 's("vibraphone_bowed")', desc: 'Bowed vibraphone' },
      { code: 's("marimba")', desc: 'VCSL Marimba' },
      { code: 's("timpani")', desc: 'VCSL Timpani' },
      { code: 's("timpani_roll")', desc: 'Timpani roll' },
      { code: 's("tubularbells")', desc: 'Tubular bells' },
      { code: 's("kalimba")', desc: 'VCSL Kalimba' },
      { code: 's("balafon")', desc: 'Balafon' },
      { code: 's("handbells")', desc: 'Handbells' },
      { code: 's("handchimes")', desc: 'Hand chimes' },
      { code: 's("slitdrum")', desc: 'Slit drum' },
      { code: 's("agogo")', desc: 'Agogo' },
      { code: 's("cowbell")', desc: 'VCSL Cowbell' },
      { code: 's("tambourine")', desc: 'Tambourine' },
      { code: 's("sleighbells")', desc: 'Sleigh bells' },
      { code: 's("triangles")', desc: 'Triangle' },
      { code: 's("woodblock")', desc: 'VCSL Woodblock' },
      { code: 's("clave")', desc: 'Clave' },
    ],
  },
  {
    label: 'VCSL Melodic',
    icon: '🎻',
    section: 'instrument',
    items: [
      { code: 's("steinway")', desc: 'Steinway piano' },
      { code: 's("fmpiano")', desc: 'FM Piano' },
      { code: 's("kawai")', desc: 'Kawai piano' },
      { code: 's("folkharp")', desc: 'Folk harp' },
      { code: 's("harp")', desc: 'VCSL Harp' },
      { code: 's("psaltery_pluck")', desc: 'Psaltery pluck' },
      { code: 's("psaltery_bow")', desc: 'Psaltery bowed' },
      { code: 's("harmonica")', desc: 'VCSL Harmonica' },
      { code: 's("harmonica_vib")', desc: 'Harmonica vibrato' },
      { code: 's("ocarina")', desc: 'VCSL Ocarina' },
      { code: 's("ocarina_vib")', desc: 'Ocarina vibrato' },
      { code: 's("recorder_alto_sus")', desc: 'Recorder alto' },
      { code: 's("recorder_soprano_sus")', desc: 'Recorder soprano' },
      { code: 's("sax")', desc: 'VCSL Saxophone' },
      { code: 's("saxello")', desc: 'Saxello' },
      { code: 's("wineglass")', desc: 'Wine glass — eerie' },
      { code: 's("clavisynth")', desc: 'Clavi synth' },
      { code: 's("didgeridoo")', desc: 'Didgeridoo' },
      { code: 's("dantranh")', desc: 'Dan Tranh — Vietnamese' },
      { code: 's("strumstick")', desc: 'Strumstick' },
      { code: 's("super64")', desc: 'Super 64 harmonica' },
    ],
  },
  // ──────────────── GM SOUNDFONTS (128 instruments) ────────────────
  {
    label: 'GM Piano & Keys',
    icon: '🎹',
    section: 'instrument',
    items: [
      { code: 's("gm_piano")', desc: 'Acoustic Grand Piano' },
      { code: 's("gm_epiano1")', desc: 'Electric Piano 1 (Rhodes)' },
      { code: 's("gm_epiano2")', desc: 'Electric Piano 2 (DX7)' },
      { code: 's("gm_harpsichord")', desc: 'Harpsichord' },
      { code: 's("gm_clavinet")', desc: 'Clavinet' },
      { code: 's("gm_celesta")', desc: 'Celesta' },
      { code: 's("gm_music_box")', desc: 'Music Box' },
      { code: 's("gm_glockenspiel")', desc: 'GM Glockenspiel' },
      { code: 's("gm_vibraphone")', desc: 'GM Vibraphone' },
      { code: 's("gm_marimba")', desc: 'GM Marimba' },
      { code: 's("gm_xylophone")', desc: 'GM Xylophone' },
      { code: 's("gm_tubular_bells")', desc: 'Tubular Bells' },
      { code: 's("gm_dulcimer")', desc: 'Dulcimer' },
    ],
  },
  {
    label: 'GM Organ',
    icon: '⛪',
    section: 'instrument',
    items: [
      { code: 's("gm_drawbar_organ")', desc: 'Drawbar Organ' },
      { code: 's("gm_percussive_organ")', desc: 'Percussive Organ' },
      { code: 's("gm_rock_organ")', desc: 'Rock Organ' },
      { code: 's("gm_church_organ")', desc: 'Church Organ' },
      { code: 's("gm_reed_organ")', desc: 'Reed Organ' },
      { code: 's("gm_accordion")', desc: 'Accordion' },
      { code: 's("gm_harmonica")', desc: 'GM Harmonica' },
      { code: 's("gm_bandoneon")', desc: 'Bandoneon' },
    ],
  },
  {
    label: 'GM Guitar & Bass',
    icon: '🎸',
    section: 'instrument',
    items: [
      { code: 's("gm_acoustic_guitar_nylon")', desc: 'Nylon Guitar' },
      { code: 's("gm_acoustic_guitar_steel")', desc: 'Steel Guitar' },
      { code: 's("gm_electric_guitar_jazz")', desc: 'Jazz Guitar' },
      { code: 's("gm_electric_guitar_clean")', desc: 'Clean Electric' },
      { code: 's("gm_electric_guitar_muted")', desc: 'Muted Guitar' },
      { code: 's("gm_overdriven_guitar")', desc: 'Overdriven Guitar' },
      { code: 's("gm_distortion_guitar")', desc: 'Distortion Guitar' },
      { code: 's("gm_guitar_harmonics")', desc: 'Guitar Harmonics' },
      { code: 's("gm_acoustic_bass")', desc: 'Acoustic Bass' },
      { code: 's("gm_electric_bass_finger")', desc: 'Finger Bass' },
      { code: 's("gm_electric_bass_pick")', desc: 'Pick Bass' },
      { code: 's("gm_fretless_bass")', desc: 'Fretless Bass' },
      { code: 's("gm_slap_bass_1")', desc: 'Slap Bass 1' },
      { code: 's("gm_slap_bass_2")', desc: 'Slap Bass 2' },
      { code: 's("gm_synth_bass_1")', desc: 'Synth Bass 1' },
      { code: 's("gm_synth_bass_2")', desc: 'Synth Bass 2' },
    ],
  },
  {
    label: 'GM Strings & Orch',
    icon: '🎻',
    section: 'instrument',
    items: [
      { code: 's("gm_violin")', desc: 'Violin' },
      { code: 's("gm_viola")', desc: 'Viola' },
      { code: 's("gm_cello")', desc: 'Cello' },
      { code: 's("gm_contrabass")', desc: 'Contrabass' },
      { code: 's("gm_tremolo_strings")', desc: 'Tremolo Strings' },
      { code: 's("gm_pizzicato_strings")', desc: 'Pizzicato Strings' },
      { code: 's("gm_orchestral_harp")', desc: 'Orchestral Harp' },
      { code: 's("gm_timpani")', desc: 'GM Timpani' },
      { code: 's("gm_string_ensemble_1")', desc: 'String Ensemble 1' },
      { code: 's("gm_string_ensemble_2")', desc: 'String Ensemble 2' },
      { code: 's("gm_synth_strings_1")', desc: 'Synth Strings 1' },
      { code: 's("gm_synth_strings_2")', desc: 'Synth Strings 2' },
    ],
  },
  {
    label: 'GM Choir & Voice',
    icon: '🎤',
    section: 'instrument',
    items: [
      { code: 's("gm_choir_aahs")', desc: 'Choir Aahs' },
      { code: 's("gm_voice_oohs")', desc: 'Voice Oohs' },
      { code: 's("gm_synth_choir")', desc: 'Synth Choir' },
      { code: 's("gm_orchestra_hit")', desc: 'Orchestra Hit' },
    ],
  },
  {
    label: 'GM Brass',
    icon: '🎺',
    section: 'instrument',
    items: [
      { code: 's("gm_trumpet")', desc: 'Trumpet' },
      { code: 's("gm_trombone")', desc: 'Trombone' },
      { code: 's("gm_tuba")', desc: 'Tuba' },
      { code: 's("gm_muted_trumpet")', desc: 'Muted Trumpet' },
      { code: 's("gm_french_horn")', desc: 'French Horn' },
      { code: 's("gm_brass_section")', desc: 'Brass Section' },
      { code: 's("gm_synth_brass_1")', desc: 'Synth Brass 1' },
      { code: 's("gm_synth_brass_2")', desc: 'Synth Brass 2' },
    ],
  },
  {
    label: 'GM Woodwind',
    icon: '🪈',
    section: 'instrument',
    items: [
      { code: 's("gm_soprano_sax")', desc: 'Soprano Sax' },
      { code: 's("gm_alto_sax")', desc: 'Alto Sax' },
      { code: 's("gm_tenor_sax")', desc: 'Tenor Sax' },
      { code: 's("gm_baritone_sax")', desc: 'Baritone Sax' },
      { code: 's("gm_oboe")', desc: 'Oboe' },
      { code: 's("gm_english_horn")', desc: 'English Horn' },
      { code: 's("gm_bassoon")', desc: 'Bassoon' },
      { code: 's("gm_clarinet")', desc: 'Clarinet' },
      { code: 's("gm_piccolo")', desc: 'Piccolo' },
      { code: 's("gm_flute")', desc: 'Flute' },
      { code: 's("gm_recorder")', desc: 'Recorder' },
      { code: 's("gm_pan_flute")', desc: 'Pan Flute' },
      { code: 's("gm_blown_bottle")', desc: 'Blown Bottle' },
      { code: 's("gm_shakuhachi")', desc: 'Shakuhachi' },
      { code: 's("gm_whistle")', desc: 'Whistle' },
      { code: 's("gm_ocarina")', desc: 'GM Ocarina' },
    ],
  },
  {
    label: 'GM Synth Leads',
    icon: '⚡',
    section: 'instrument',
    items: [
      { code: 's("gm_lead_1_square")', desc: 'Lead 1 — Square' },
      { code: 's("gm_lead_2_sawtooth")', desc: 'Lead 2 — Sawtooth' },
      { code: 's("gm_lead_3_calliope")', desc: 'Lead 3 — Calliope' },
      { code: 's("gm_lead_4_chiff")', desc: 'Lead 4 — Chiff' },
      { code: 's("gm_lead_5_charang")', desc: 'Lead 5 — Charang' },
      { code: 's("gm_lead_6_voice")', desc: 'Lead 6 — Voice' },
      { code: 's("gm_lead_7_fifths")', desc: 'Lead 7 — Fifths' },
      { code: 's("gm_lead_8_bass_lead")', desc: 'Lead 8 — Bass+Lead' },
    ],
  },
  {
    label: 'GM Synth Pads',
    icon: '🌊',
    section: 'instrument',
    items: [
      { code: 's("gm_pad_new_age")', desc: 'Pad — New Age' },
      { code: 's("gm_pad_warm")', desc: 'Pad — Warm' },
      { code: 's("gm_pad_poly")', desc: 'Pad — Polysynth' },
      { code: 's("gm_pad_choir")', desc: 'Pad — Choir' },
      { code: 's("gm_pad_bowed")', desc: 'Pad — Bowed' },
      { code: 's("gm_pad_metallic")', desc: 'Pad — Metallic' },
      { code: 's("gm_pad_halo")', desc: 'Pad — Halo' },
      { code: 's("gm_pad_sweep")', desc: 'Pad — Sweep' },
    ],
  },
  {
    label: 'GM FX & SFX',
    icon: '✨',
    section: 'sound',
    items: [
      { code: 's("gm_fx_rain")', desc: 'FX — Rain' },
      { code: 's("gm_fx_soundtrack")', desc: 'FX — Soundtrack' },
      { code: 's("gm_fx_crystal")', desc: 'FX — Crystal' },
      { code: 's("gm_fx_atmosphere")', desc: 'FX — Atmosphere' },
      { code: 's("gm_fx_brightness")', desc: 'FX — Brightness' },
      { code: 's("gm_fx_goblins")', desc: 'FX — Goblins' },
      { code: 's("gm_fx_echoes")', desc: 'FX — Echoes' },
      { code: 's("gm_fx_sci_fi")', desc: 'FX — Sci-Fi' },
      { code: 's("gm_guitar_fret_noise")', desc: 'Guitar fret noise' },
      { code: 's("gm_breath_noise")', desc: 'Breath noise' },
      { code: 's("gm_seashore")', desc: 'Seashore' },
      { code: 's("gm_bird_tweet")', desc: 'Bird tweet' },
      { code: 's("gm_telephone")', desc: 'Telephone ring' },
      { code: 's("gm_helicopter")', desc: 'Helicopter' },
      { code: 's("gm_applause")', desc: 'Applause' },
      { code: 's("gm_gunshot")', desc: 'Gunshot' },
    ],
  },
  {
    label: 'GM Ethnic',
    icon: 'ðŸŒ',
    section: 'instrument',
    items: [
      { code: 's("gm_sitar")', desc: 'GM Sitar' },
      { code: 's("gm_banjo")', desc: 'Banjo' },
      { code: 's("gm_shamisen")', desc: 'Shamisen' },
      { code: 's("gm_koto")', desc: 'Koto' },
      { code: 's("gm_kalimba")', desc: 'GM Kalimba' },
      { code: 's("gm_bagpipe")', desc: 'Bagpipe' },
      { code: 's("gm_fiddle")', desc: 'Fiddle' },
      { code: 's("gm_shanai")', desc: 'Shanai (Shehnai)' },
    ],
  },
  {
    label: 'GM Perc & Misc',
    icon: '🔔',
    section: 'sound',
    items: [
      { code: 's("gm_tinkle_bell")', desc: 'Tinkle Bell' },
      { code: 's("gm_agogo")', desc: 'GM Agogo' },
      { code: 's("gm_steel_drums")', desc: 'Steel Drums' },
      { code: 's("gm_woodblock")', desc: 'GM Woodblock' },
      { code: 's("gm_taiko_drum")', desc: 'Taiko Drum' },
      { code: 's("gm_melodic_tom")', desc: 'Melodic Tom' },
      { code: 's("gm_synth_drum")', desc: 'Synth Drum' },
      { code: 's("gm_reverse_cymbal")', desc: 'Reverse Cymbal' },
    ],
  },
  // ──────────────── ZZFX GENERATORS ────────────────
  {
    label: 'ZZFX Generators',
    icon: '🎮',
    section: 'instrument',
    items: [
      { code: 's("zzfx")', desc: 'ZZFX — procedural SFX' },
      { code: 's("z_sine")', desc: 'ZZFX sine generator' },
      { code: 's("z_sawtooth")', desc: 'ZZFX sawtooth generator' },
      { code: 's("z_triangle")', desc: 'ZZFX triangle generator' },
      { code: 's("z_square")', desc: 'ZZFX square generator' },
      { code: 's("z_tan")', desc: 'ZZFX tan generator' },
      { code: 's("z_noise")', desc: 'ZZFX noise generator' },
    ],
  },
]

// ─── Method types ───

interface KnobMethodDef {
  type: 'knob'
  label: string
  desc: string
  codeTemplate: string
  min: number
  max: number
  default: number
  step: number
  unit?: string
  color?: string
}

interface ButtonMethodDef {
  type: 'button'
  code: string
  desc: string
}

type MethodDef = KnobMethodDef | ButtonMethodDef

interface MethodSection {
  label: string
  icon: string
  category: 'universal' | 'sound' | 'visual'
  methods: MethodDef[]
}

// ─── Method Reference: organized by Universal / Sound / Visual ───

export const ORGANIZED_METHODS: MethodSection[] = [
  // â•â•â•â•â•â• UNIVERSAL — works on any channel â•â•â•â•â•â•
  {
    label: 'Mix',
    icon: '📊',
    category: 'universal',
    methods: [
      { type: 'knob', label: 'GAIN', desc: 'Volume level', codeTemplate: '.gain({v})', min: 0, max: 2, default: 0.8, step: 0.01, color: '#7fa998' },
      { type: 'knob', label: 'PAN', desc: 'Stereo position', codeTemplate: '.pan({v})', min: 0, max: 1, default: 0.5, step: 0.01, color: '#6f8fb3' },
      { type: 'knob', label: 'ORBIT', desc: 'FX bus routing', codeTemplate: '.orbit({v})', min: 0, max: 8, default: 0, step: 1, color: '#b8a47f' },
    ],
  },
  {
    label: 'Space',
    icon: '🌌',
    category: 'universal',
    methods: [
      { type: 'knob', label: 'ROOM', desc: 'Reverb amount', codeTemplate: '.room({v})', min: 0, max: 1, default: 0.5, step: 0.01, color: '#6f8fb3' },
      { type: 'knob', label: 'SIZE', desc: 'Room size', codeTemplate: '.roomsize({v})', min: 0, max: 10, default: 2, step: 0.1, color: '#6f8fb3' },
      { type: 'knob', label: 'DELAY', desc: 'Delay mix', codeTemplate: '.delay({v})', min: 0, max: 1, default: 0.25, step: 0.01, color: '#6f8fb3' },
      { type: 'knob', label: 'DLY FB', desc: 'Delay feedback', codeTemplate: '.delayfeedback({v})', min: 0, max: 1, default: 0.5, step: 0.01, color: '#6f8fb3' },
      { type: 'knob', label: 'DLY T', desc: 'Delay time', codeTemplate: '.delaytime({v})', min: 0, max: 1, default: 0.375, step: 0.001, color: '#6f8fb3' },
    ],
  },
  {
    label: 'Time',
    icon: 'â±ï¸',
    category: 'universal',
    methods: [
      { type: 'knob', label: 'FAST', desc: 'Speed multiplier', codeTemplate: '.fast({v})', min: 0.25, max: 8, default: 2, step: 0.25, color: '#b8a47f' },
      { type: 'knob', label: 'SLOW', desc: 'Slow factor', codeTemplate: '.slow({v})', min: 0.25, max: 8, default: 2, step: 0.25, color: '#b8a47f' },
      { type: 'knob', label: 'SPEED', desc: 'Playback speed', codeTemplate: '.speed({v})', min: -4, max: 4, default: 1, step: 0.1, color: '#b8a47f' },
    ],
  },
  {
    label: 'Pattern',
    icon: '🧩',
    category: 'universal',
    methods: [
      { type: 'button', code: '.jux(rev)', desc: 'Reverse in other ear' },
      { type: 'button', code: '.rarely(add(note(12)))', desc: 'Occasionally +octave' },
      { type: 'button', code: '.chunk(4, add(note(12)))', desc: 'Transpose ¼ pattern' },
      { type: 'button', code: '.off(1/4, add(note(12)))', desc: 'Delayed octave echo' },
      { type: 'button', code: '.struct("<x(3,8) x*2>*2")', desc: 'Euclidean rhythm' },
      { type: 'button', code: 'irand(10).sub(7).seg(16)', desc: 'Random 16-step seq' },
    ],
  },
  {
    label: 'Sidechain',
    icon: '🦆',
    category: 'universal',
    methods: [
      { type: 'knob', label: 'DUCK', desc: 'Sidechain trigger', codeTemplate: '.duck("{v}")', min: 0, max: 4, default: 1, step: 1, color: '#7fa998' },
      { type: 'knob', label: 'DEPTH', desc: 'Duck depth', codeTemplate: '.duckdepth({v})', min: 0, max: 1, default: 0.8, step: 0.01, color: '#7fa998' },
      { type: 'knob', label: 'ATK', desc: 'Duck attack', codeTemplate: '.duckattack({v})', min: 0, max: 1, default: 0.2, step: 0.01, color: '#7fa998' },
    ],
  },
  // â•â•â•â•â•â• SOUND-SPECIFIC — affects tone & pitch â•â•â•â•â•â•
  {
    label: 'Filter',
    icon: '🎛ï¸',
    category: 'sound',
    methods: [
      { type: 'knob', label: 'LPF', desc: 'Low-pass filter', codeTemplate: '.lpf({v})', min: 20, max: 20000, default: 800, step: 10, unit: 'Hz', color: '#b86f6f' },
      { type: 'knob', label: 'HPF', desc: 'High-pass filter', codeTemplate: '.hpf({v})', min: 20, max: 20000, default: 400, step: 10, unit: 'Hz', color: '#b86f6f' },
      { type: 'knob', label: 'RES', desc: 'Filter resonance', codeTemplate: '.lpq({v})', min: 0, max: 50, default: 8, step: 0.5, color: '#b86f6f' },
      { type: 'knob', label: 'FENV', desc: 'Filter envelope', codeTemplate: '.lpenv({v})', min: -10, max: 10, default: 4, step: 0.5, color: '#b86f6f' },
    ],
  },
  {
    label: 'Distortion',
    icon: '💥',
    category: 'sound',
    methods: [
      { type: 'knob', label: 'SHAPE', desc: 'Waveshaping', codeTemplate: '.shape({v})', min: 0, max: 1, default: 0.3, step: 0.01, color: '#b86f6f' },
      { type: 'knob', label: 'DIST', desc: 'Distortion amount', codeTemplate: '.distort({v})', min: 0, max: 1, default: 0.5, step: 0.01, color: '#b86f6f' },
      { type: 'knob', label: 'CRUSH', desc: 'Bit crush depth', codeTemplate: '.crush({v})', min: 1, max: 16, default: 8, step: 1, color: '#b86f6f' },
    ],
  },
  {
    label: 'Pitch',
    icon: '🎵',
    category: 'sound',
    methods: [
      { type: 'knob', label: 'TRANS', desc: 'Transpose semitones', codeTemplate: '.trans({v})', min: -24, max: 24, default: -12, step: 1, color: '#b8a47f' },
      { type: 'knob', label: 'DETUNE', desc: 'Detune amount', codeTemplate: '.detune({v})', min: 0, max: 10, default: 1, step: 0.1, color: '#b8a47f' },
      { type: 'button', code: '.scale("c:minor")', desc: 'Scale quantize' },
      { type: 'button', code: '.voicing()', desc: 'Auto voice lead' },
      { type: 'button', code: '.chord("Em")', desc: 'Chord shape' },
      { type: 'button', code: '.add(note(12))', desc: 'Add octave' },
      { type: 'button', code: '.off(1/8, x => x.add(note(7)))', desc: 'Delayed 5th harmony' },
    ],
  },
  {
    label: 'Modulation',
    icon: '〰ï¸',
    category: 'sound',
    methods: [
      { type: 'knob', label: 'VIB', desc: 'Vibrato rate', codeTemplate: '.vib("{v}:.25")', min: 1, max: 16, default: 8, step: 1, color: '#b8a47f' },
      { type: 'button', code: '.pan(sine.range(.2,.8).slow(8))', desc: 'Auto-panning LFO' },
      { type: 'button', code: 'perlin.range(300,800).slow(4)', desc: 'Perlin noise LFO' },
      { type: 'button', code: 'sine.range(0,1).slow(8)', desc: 'Sine LFO' },
      { type: 'button', code: 'saw.slow(4).range(200,2000)', desc: 'Saw LFO' },
      { type: 'button', code: 'slider(.5, 0, 1)', desc: 'Live slider control' },
    ],
  },
  // â•â•â•â•â•â• VISUAL â•â•â•â•â•â•
  {
    label: 'Visual',
    icon: '📊',
    category: 'visual',
    methods: [
      { type: 'button', code: '.scope()', desc: 'Oscilloscope' },
      { type: 'button', code: '.pianoroll()', desc: 'Piano roll view' },
      { type: 'button', code: '.punchcard()', desc: 'Punchcard grid' },
    ],
  },
]

// ─── Component ───

interface StudioMethodsPanelProps {
  onInsert: (snippet: string) => void
  onPreview?: (soundCode: string) => void
}

// Force emoji font so iPadOS doesn't render emoji glyphs through monospace
const emojiFont = '"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif'

export default function StudioMethodsPanel({ onInsert, onPreview }: StudioMethodsPanelProps) {
  const [activeTab, setActiveTab] = useState<'sounds' | 'methods'>('sounds')
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [previewingCode, setPreviewingCode] = useState<string | null>(null)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [knobValues, setKnobValues] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {}
    ORGANIZED_METHODS.forEach(section => {
      section.methods.forEach(m => {
        if (m.type === 'knob') defaults[m.label] = m.default
      })
    })
    return defaults
  })

  const copySnippet = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet)
    setCopiedSnippet(snippet)
    setTimeout(() => setCopiedSnippet(null), 1500)
  }, [])

  const handlePreview = useCallback((code: string) => {
    if (!onPreview) return
    setPreviewingCode(code)
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => setPreviewingCode(null), 600)
    onPreview(code)
  }, [onPreview])

  const generateCode = useCallback((m: KnobMethodDef, val: number) => {
    return m.codeTemplate.replace('{v}', val.toString())
  }, [])

  // ── SOUNDS tab filter ──
  const filteredSounds = search.trim()
    ? SOUND_BANKS.map(cat => {
        const matching = cat.items.filter(
          m => m.code.toLowerCase().includes(search.toLowerCase()) ||
               m.desc.toLowerCase().includes(search.toLowerCase())
        )
        return matching.length > 0 ? { ...cat, items: matching } : null
      }).filter(Boolean) as typeof SOUND_BANKS
    : SOUND_BANKS

  // ── METHODS tab filter ──
  const filteredMethods = search.trim()
    ? ORGANIZED_METHODS.map(section => {
        const matching = section.methods.filter(m => {
          const q = search.toLowerCase()
          if (m.type === 'knob') {
            return m.label.toLowerCase().includes(q) ||
                   m.desc.toLowerCase().includes(q) ||
                   m.codeTemplate.toLowerCase().includes(q)
          }
          return m.code.toLowerCase().includes(q) ||
                 m.desc.toLowerCase().includes(q)
        })
        return matching.length > 0 ? { ...section, methods: matching } : null
      }).filter(Boolean) as typeof ORGANIZED_METHODS
    : ORGANIZED_METHODS

  // Group methods by category
  const universalMethods = filteredMethods.filter(s => s.category === 'universal')
  const soundMethods = filteredMethods.filter(s => s.category === 'sound')
  const visualMethods = filteredMethods.filter(s => s.category === 'visual')

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Tab switcher — clay pills */}
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
        <button
          onClick={() => { setActiveTab('sounds'); setExpandedCat(null); setSearch('') }}
          className="flex-1 text-[8px] font-bold uppercase tracking-[.15em] py-1.5 rounded-xl transition-all duration-[180ms] cursor-pointer"
          style={{
            background: activeTab === 'sounds' ? '#16181d' : '#111318',
            border: 'none',
            color: activeTab === 'sounds' ? '#7fa998' : '#5a616b',
            boxShadow: activeTab === 'sounds'
              ? 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22'
              : '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
          }}
        >
          <span style={{ fontFamily: emojiFont }}>🎹</span> SOUNDS
        </button>
        <button
          onClick={() => { setActiveTab('methods'); setExpandedCat(null); setSearch('') }}
          className="flex-1 text-[8px] font-bold uppercase tracking-[.15em] py-1.5 rounded-xl transition-all duration-[180ms] cursor-pointer"
          style={{
            background: activeTab === 'methods' ? '#16181d' : '#111318',
            border: 'none',
            color: activeTab === 'methods' ? '#b8a47f' : '#5a616b',
            boxShadow: activeTab === 'methods'
              ? 'inset 3px 3px 6px #050607, inset -3px -3px 6px #1a1d22'
              : '3px 3px 6px #050607, -3px -3px 6px #1a1d22',
          }}
        >
          <span style={{ fontFamily: emojiFont }}>🔧</span> METHODS
        </button>
      </div>

      {/* Search — clay inset input */}
      <div className="px-2 py-1">
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#5a616b' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'sounds' ? 'Search instruments...' : 'Search methods...'}
            className="w-full rounded-xl text-[9px] pl-6 pr-2 py-1.5 outline-none font-mono"
            style={{
              color: '#e8ecf0',
              background: '#0a0b0d',
              border: 'none',
              boxShadow: 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22',
            }}
          />
        </div>
      </div>

      {/* â•â•â• SOUNDS tab — accordion categories grouped by type â•â•â• */}
      {activeTab === 'sounds' && (
        <div className="px-1 pb-3 space-y-0.5">
          {filteredSounds.length === 0 && (
            <div className="text-center py-4 text-[9px]" style={{ color: '#5a616b' }}>No results for &quot;{search}&quot;</div>
          )}
          {([
            { key: 'instrument' as const, label: 'INSTRUMENTS', icon: '🎹', color: '#6f8fb3', desc: 'Pitched / note-based' },
            { key: 'sound' as const, label: 'SOUNDS', icon: 'ðŸ¥', color: '#b8a47f', desc: 'Drums, samples & FX' },
            { key: 'bank' as const, label: 'BANKS', icon: '🎛ï¸', color: '#b86f6f', desc: 'Drum machine presets' },
          ] as const).map(sectionDef => {
            const sectionCats = filteredSounds.filter(c => c.section === sectionDef.key)
            if (sectionCats.length === 0) return null
            return (
              <div key={sectionDef.key}>
                {/* Section header */}
                <div className="flex items-center gap-1.5 px-2 py-1 mt-1.5 mb-0.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[7px]" style={{ fontFamily: emojiFont }}>{sectionDef.icon}</span>
                  <span className="text-[7px] font-black uppercase tracking-[.25em]" style={{ color: sectionDef.color }}>{sectionDef.label}</span>
                  <span className="text-[6px] ml-auto" style={{ color: '#5a616b' }}>{sectionDef.desc}</span>
                </div>
                {sectionCats.map((cat) => (
            <div key={cat.label}>
              <button
                onClick={() => setExpandedCat(expandedCat === cat.label ? null : cat.label)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-bold transition-colors duration-[180ms] cursor-pointer rounded-xl"
                style={{
                  color: expandedCat === cat.label ? '#e8ecf0' : '#5a616b',
                  background: expandedCat === cat.label ? '#16181d' : 'transparent',
                }}
              >
                <span style={{ fontFamily: emojiFont }}>{cat.icon}</span>
                <span className="flex-1 text-left uppercase tracking-wider">{cat.label}</span>
                <span className="text-[7px] font-mono" style={{ color: '#5a616b' }}>{cat.items.length}</span>
                {expandedCat === cat.label ? <ChevronDown size={8} /> : <ChevronRight size={8} />}
              </button>
              {expandedCat === cat.label && (
                <div className="ml-2 space-y-0.5 mb-1">
                  {cat.items.map((m) => {
                    const isBankCode = m.code.startsWith('.bank(')
                    const soundMatch = m.code.match(/^s\(["']([^"']+)["']\)$/)
                    const bankMatch = m.code.match(/^\.bank\(["']([^"']+)["']\)$/)
                    const soundName = soundMatch?.[1] || ''
                    const bankName = bankMatch?.[1] || ''
                    return (
                      <div
                        key={m.code}
                        draggable
                        onDragStart={(e) => {
                          if (isBankCode) {
                            e.dataTransfer.setData('application/x-strudel-sound', JSON.stringify({
                              type: 'bank', name: bankName, code: m.code, desc: m.desc,
                            }))
                          } else {
                            const isSynth = ['sawtooth','supersaw','sine','square','triangle','pulse','sbd','white','pink','brown','crackle','zzfx','z_sine','z_sawtooth','z_triangle','z_square','z_tan','z_noise'].includes(soundName)
                            e.dataTransfer.setData('application/x-strudel-sound', JSON.stringify({
                              type: isSynth ? 'synth' : 'sample', name: soundName, code: m.code, desc: m.desc,
                            }))
                          }
                          e.dataTransfer.effectAllowed = 'copy'
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg group cursor-grab active:cursor-grabbing transition-colors"
                        style={{ background: 'transparent' }}
                        onClick={() => onInsert(m.code)}
                        title={`Drag onto a channel or click to insert\n${m.code} — ${m.desc}`}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <div className="flex-1 min-w-0">
                          <code className="text-[9px] font-mono truncate block" style={{ color: '#7fa998', opacity: 0.7 }}>{m.code}</code>
                          <span className="text-[7px] truncate block" style={{ color: '#5a616b' }}>{m.desc}</span>
                        </div>
                        {/* Preview button */}
                        {onPreview && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreview(m.code) }}
                            className="shrink-0 transition-all cursor-pointer rounded-md p-0.5"
                            style={{
                              color: previewingCode === m.code ? '#7fa998' : '#5a616b',
                              opacity: previewingCode === m.code ? 1 : 0.4,
                              background: previewingCode === m.code ? 'rgba(127,169,152,0.15)' : 'transparent',
                            }}
                            title="Preview sound"
                            onMouseEnter={(e) => { if (previewingCode !== m.code) e.currentTarget.style.opacity = '0.8' }}
                            onMouseLeave={(e) => { if (previewingCode !== m.code) e.currentTarget.style.opacity = '0.4' }}
                          >
                            <Volume2 size={10} />
                          </button>
                        )}
                        <span className="opacity-0 group-hover:opacity-40 text-[8px] shrink-0 mr-0.5" style={{ color: '#5a616b' }}>⠣</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copySnippet(m.code) }}
                          className="opacity-0 group-hover:opacity-100 transition-all cursor-pointer shrink-0"
                          style={{ color: '#5a616b' }}
                          title="Copy"
                        >
                          {copiedSnippet === m.code ? <Check size={9} className="text-emerald-400" /> : <Copy size={9} />}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
              </div>
            )
          })}
        </div>
      )}

      {/* â•â•â• METHODS tab — knobs + buttons organized by category â•â•â• */}
      {activeTab === 'methods' && (
        <div className="px-1 pb-3 space-y-1">
          {filteredMethods.length === 0 && (
            <div className="text-center py-4 text-[9px]" style={{ color: '#5a616b' }}>No results for &quot;{search}&quot;</div>
          )}

          {[
            { label: 'UNIVERSAL', icon: '⚡', sections: universalMethods, color: '#7fa998' },
            { label: 'SOUND', icon: '🎵', sections: soundMethods, color: '#b86f6f' },
            { label: 'VISUAL', icon: '📊', sections: visualMethods, color: '#6f8fb3' },
          ].map(group => group.sections.length > 0 && (
            <div key={group.label}>
              {/* Category header */}
              <div className="flex items-center gap-1.5 px-2 py-1 mt-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[7px]" style={{ fontFamily: emojiFont }}>{group.icon}</span>
                <span className="text-[7px] font-black uppercase tracking-[.25em]" style={{ color: group.color }}>{group.label}</span>
              </div>

              {group.sections.map(section => {
                const knobs = section.methods.filter((m): m is KnobMethodDef => m.type === 'knob')
                const buttons = section.methods.filter((m): m is ButtonMethodDef => m.type === 'button')

                return (
                  <div key={section.label} className="mb-0.5">
                    {/* Section label */}
                    <div className="px-2 pt-1.5 pb-0.5 text-[7px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: '#5a616b' }}>
                      <span style={{ fontFamily: emojiFont }}>{section.icon}</span>
                      <span>{section.label}</span>
                    </div>

                    {/* Knob grid */}
                    {knobs.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 px-1 py-0.5 justify-start">
                        {knobs.map(m => {
                          const val = knobValues[m.label] ?? m.default
                          const code = generateCode(m, val)
                          return (
                            <div
                              key={m.label}
                              className="flex flex-col items-center group rounded-lg p-1 transition-all duration-[180ms]"
                              style={{ minWidth: 44 }}
                              title={`${m.desc}\nClick insert or drag to channel\n${code}`}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                            >
                              {/* Knob — blocks HTML drag so value adjustment works */}
                              <div onDragStart={(e) => e.preventDefault()} draggable={false}>
                                <StudioKnob
                                  label={m.label}
                                  value={val}
                                  min={m.min}
                                  max={m.max}
                                  step={m.step}
                                  size={30}
                                  color={m.color || '#7fa998'}
                                  unit={m.unit}
                                  onChange={(v) => setKnobValues(prev => ({ ...prev, [m.label]: v }))}
                                />
                              </div>
                              {/* Insert button — also draggable for D&D to channels */}
                              <div
                                className="mt-0.5 px-1.5 py-0.5 rounded-md cursor-pointer opacity-50 group-hover:opacity-100 transition-all text-center"
                                style={{
                                  background: 'rgba(255,255,255,0.02)',
                                  color: m.color || '#7fa998',
                                }}
                                onClick={() => onInsert(code)}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify({
                                    code, label: m.desc, target: 'both',
                                  }))
                                  e.dataTransfer.effectAllowed = 'copy'
                                }}
                              >
                                <span className="text-[5px] font-bold uppercase tracking-wider">insert</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Button list */}
                    {buttons.length > 0 && (
                      <div className="flex flex-wrap gap-1 px-1.5 py-0.5">
                        {buttons.map(m => (
                          <button
                            key={m.code}
                            onClick={() => onInsert(m.code)}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify({
                                code: m.code, label: m.desc, target: 'both',
                              }))
                              e.dataTransfer.effectAllowed = 'copy'
                            }}
                            className="text-[7px] font-mono px-1.5 py-1 rounded-lg transition-all duration-[180ms] cursor-pointer group/btn"
                            style={{
                              background: '#0a0b0d',
                              color: '#7fa998',
                              border: 'none',
                              boxShadow: '2px 2px 4px #050607, -2px -2px 4px #1a1d22',
                            }}
                            title={`${m.desc}\nClick to insert or drag to channel`}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.boxShadow = 'inset 2px 2px 4px #050607, inset -2px -2px 4px #1a1d22'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.boxShadow = '2px 2px 4px #050607, -2px -2px 4px #1a1d22'
                            }}
                          >
                            {m.code}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
