'use client'
// ═══════════════════════════════════════════════════════════════
//  Effects Documentation Modal
//  Shows what every Strudel effect does, parameter ranges, and
//  usage tips. Organized by category.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'

// ─── Data ──────────────────────────────────────────────────────

type EffectDocCategory =
  | 'filter' | 'drive' | 'space' | 'envelope'
  | 'modulation' | 'fm' | 'pitch' | 'tremolo'
  | 'sample' | 'dynamics' | 'pattern' | 'gain'

interface EffectDoc {
  key: string
  label: string
  category: EffectDocCategory
  range: string
  unit?: string
  desc: string
  tip?: string
}

const CATEGORY_META: { key: EffectDocCategory; label: string; icon: string; color: string }[] = [
  { key: 'filter',     label: 'Filter',      icon: '🔽', color: '#22d3ee' },
  { key: 'drive',      label: 'Drive',        icon: '🔥', color: '#ef4444' },
  { key: 'space',      label: 'Space',        icon: '🏛️', color: '#818cf8' },
  { key: 'envelope',   label: 'Envelope',     icon: '📐', color: '#a78bfa' },
  { key: 'modulation', label: 'Modulation',   icon: '🌊', color: '#22d3ee' },
  { key: 'fm',         label: 'FM Synthesis',  icon: '📻', color: '#f97316' },
  { key: 'pitch',      label: 'Pitch',        icon: '📈', color: '#facc15' },
  { key: 'tremolo',    label: 'Tremolo / AM',  icon: '〰️', color: '#10b981' },
  { key: 'sample',     label: 'Sample',       icon: '🔊', color: '#ec4899' },
  { key: 'dynamics',   label: 'Dynamics',     icon: '🗜️', color: '#64748b' },
  { key: 'pattern',    label: 'Pattern',      icon: '⚡', color: '#eab308' },
  { key: 'gain',       label: 'Gain / Level', icon: '📊', color: '#6366f1' },
]

const EFFECTS_DOCS: EffectDoc[] = [
  // ── Filter ──
  { key: 'lpf', label: 'Low-Pass Filter', category: 'filter', range: '20 – 20 000', unit: 'Hz',
    desc: 'Removes frequencies above the cutoff. Lower values = darker, muffled sound.',
    tip: 'Start around 800 Hz for a warm sound, go below 400 for deep filtering.' },
  { key: 'hpf', label: 'High-Pass Filter', category: 'filter', range: '20 – 8 000', unit: 'Hz',
    desc: 'Removes frequencies below the cutoff. Higher values = thinner, airier sound.',
    tip: 'Use 60-100 Hz to clean mud from a mix, 500+ for telephone effect.' },
  { key: 'bpf', label: 'Band-Pass Filter', category: 'filter', range: '20 – 20 000', unit: 'Hz',
    desc: 'Passes only frequencies around the cutoff — removes both highs and lows.',
    tip: 'Great for radio/walkie-talkie effects around 800-1500 Hz.' },
  { key: 'lpq', label: 'LP Resonance', category: 'filter', range: '0 – 20',
    desc: 'Adds resonance (peak) at the low-pass cutoff frequency. Higher = more piercing.',
    tip: 'Values above 10 create acid-style squelch. Above 15 will self-oscillate!' },
  { key: 'hpq', label: 'HP Resonance', category: 'filter', range: '0 – 20',
    desc: 'Adds resonance at the high-pass cutoff frequency.',
    tip: 'Useful with hpenv for bright filter sweeps.' },
  { key: 'bpq', label: 'BP Resonance', category: 'filter', range: '0 – 50',
    desc: 'Controls how narrow (resonant) the bandpass filter is. Higher = narrower band.',
    tip: 'Low values (1-3) for gentle shaping, 8+ for extreme radio effects.' },
  { key: 'lpenv', label: 'LP Envelope Depth', category: 'filter', range: '0 – 8',
    desc: 'How many octaves the filter sweeps upward from the cutoff. Creates filter "plucks".',
    tip: 'Combine with lpd for acid lines: .lpf(400).lpq(12).lpenv(6).lpd(.1)' },
  { key: 'hpenv', label: 'HP Envelope Depth', category: 'filter', range: '0 – 8',
    desc: 'How many octaves the high-pass filter sweeps from the cutoff.' },
  { key: 'bpenv', label: 'BP Envelope Depth', category: 'filter', range: '0 – 8',
    desc: 'How many octaves the bandpass filter sweeps from the cutoff.' },
  { key: 'lps', label: 'Filter Sustain', category: 'filter', range: '0 – 1',
    desc: 'Sustain level of the filter envelope. 0 = filter closes fully after decay.',
    tip: 'Set to 0 for plucky sounds, 0.3-0.5 for pads with filter movement.' },
  { key: 'lpd', label: 'Filter Decay', category: 'filter', range: '0 – 1', unit: 's',
    desc: 'How fast the filter envelope decays. Short = percussive, long = gradual sweep.',
    tip: 'Try .06-.12 for acid bass, .3-.5 for sweeping pads.' },
  { key: 'lpattack', label: 'Filter Attack', category: 'filter', range: '0 – 1', unit: 's',
    desc: 'Attack time of the filter envelope — how fast the filter opens.',
    tip: 'Non-zero values create a slow filter swell at note start.' },
  { key: 'lprelease', label: 'Filter Release', category: 'filter', range: '0 – 1', unit: 's',
    desc: 'Release time of the filter envelope — how fast the filter closes after note off.' },
  { key: 'ftype', label: 'Filter Type', category: 'filter', range: '0, 1, or 2',
    desc: '0 = standard, 1 = ladder (Moog-style, warmer), 2 = 24dB/oct (steeper roll-off).',
    tip: 'Ladder filter (1) adds natural warmth. Use with lpq for classic analog sound.' },
  { key: 'vowel', label: 'Vowel Filter', category: 'filter', range: '"a", "e", "i", "o", "u"',
    desc: 'Applies formant resonances mimicking human vowel sounds.',
    tip: 'Try chaining different vowels per note: .vowel("a e i o")' },

  // ── Drive ──
  { key: 'shape', label: 'Waveshaping', category: 'drive', range: '0 – 1',
    desc: 'Soft saturation/warmth. Mimics analog tape/tube overdrive.',
    tip: '0.05-0.15 for warmth, 0.3-0.5 for grit, 0.6+ for heavy distortion.' },
  { key: 'distort', label: 'Distortion', category: 'drive', range: '0 – 5',
    desc: 'Hard clipping distortion. More aggressive than shape.',
    tip: 'Values above 2 are very aggressive. Combine with lpf to tame harshness.' },
  { key: 'crush', label: 'Bitcrush', category: 'drive', range: '1 – 16',
    desc: 'Reduces bit depth. 16 = CD quality, 8 = retro, 4 = very crunchy, 1 = square wave.',
    tip: 'Great for lo-fi: .crush(10) for subtle, .crush(4) for 8-bit chiptune.' },
  { key: 'coarse', label: 'Coarse', category: 'drive', range: '1 – 32',
    desc: 'Sample rate reduction (downsampling). Creates aliasing artifacts.',
    tip: 'Values 2-4 for subtle vinyl grain; 8+ for extreme digital degradation.' },

  // ── Space ──
  { key: 'room', label: 'Reverb Amount', category: 'space', range: '0 – 1',
    desc: 'Wet/dry of the reverb effect. 0 = dry, 1 = fully wet.',
    tip: '0.1-0.2 for subtle room, 0.4-0.6 for lush, 0.8+ for ambient washes.' },
  { key: 'roomsize', label: 'Room Size', category: 'space', range: '0 – 10',
    desc: 'Size of the virtual room. Larger = longer reverb tail.',
    tip: '1-2 = small room, 4-6 = hall, 8-10 = cathedral/infinite.' },
  { key: 'roomfade', label: 'Room Fade', category: 'space', range: '0.1 – 10', unit: 's',
    desc: 'Time for the reverb tail to fade. Longer = more sustain.',
    tip: 'Short values (0.2-0.5) create gated reverb effects.' },
  { key: 'roomlp', label: 'Room Low-Pass', category: 'space', range: '200 – 20 000', unit: 'Hz',
    desc: 'Low-pass filter on the reverb signal. Darkens the reverb tail.',
    tip: 'Lower values (1000-3000) create dark, moody reverbs.' },
  { key: 'roomdim', label: 'Room Damping', category: 'space', range: '200 – 20 000', unit: 'Hz',
    desc: 'High-frequency damping of the reverb. Simulates soft room surfaces.' },
  { key: 'delay', label: 'Delay Amount', category: 'space', range: '0 – 1',
    desc: 'Wet/dry of the delay effect. 0 = no delay, 1 = full delay.',
    tip: 'Use 0.2-0.4 for subtle echo, combine with delayfeedback for more repeats.' },
  { key: 'delayfeedback', label: 'Delay Feedback', category: 'space', range: '0 – 0.95',
    desc: 'How much of the delayed signal feeds back. Higher = more repeats.',
    tip: 'Above 0.7 creates long echo trails. Stay below 0.9 to avoid runaway feedback!' },
  { key: 'delaytime', label: 'Delay Time', category: 'space', range: '0.01 – 1', unit: 's',
    desc: 'Time between delay repeats. 0.25 = quarter note at 60 BPM.',
    tip: 'Musical values: 0.125 (8th), 0.25 (quarter), 0.375 (dotted 8th), 0.333 (triplet).' },
  { key: 'dry', label: 'Dry Level', category: 'space', range: '0 – 1',
    desc: 'Controls the dry (unprocessed) signal level. 0 = reverb-only, 1 = full dry.',
    tip: 'Lower to 0.3-0.5 when using heavy reverb for ambient washes.' },
  { key: 'orbit', label: 'Orbit', category: 'space', range: '0 – 11',
    desc: 'Routes sound to a separate reverb/delay bus. Each orbit has independent effects.',
    tip: 'Use different orbits to give instruments separate reverb spaces.' },

  // ── Envelope ──
  { key: 'attack', label: 'Attack', category: 'envelope', range: '0 – 2', unit: 's',
    desc: 'Time from silence to full volume after a note starts.',
    tip: '0 = instant (percussive), 0.1-0.3 for pads, 0.5+ for slow swells.' },
  { key: 'decay', label: 'Decay', category: 'envelope', range: '0 – 5', unit: 's',
    desc: 'Time from peak to sustain level.',
    tip: 'Short (0.1-0.2) for plucks, longer (0.3-0.8) for keys.' },
  { key: 'sustain', label: 'Sustain', category: 'envelope', range: '0 – 1',
    desc: 'Level maintained while note is held. 0 = dies after decay, 1 = stays at full.',
    tip: 'Set to 0 for percussive plucks, 0.7-1.0 for sustained pads/leads.' },
  { key: 'rel', label: 'Release', category: 'envelope', range: '0 – 10', unit: 's',
    desc: 'Time from note-off to silence.',
    tip: 'Short (0.1) for tight, long (1-3) for ambient tails. Also: .release()' },
  { key: 'legato', label: 'Legato', category: 'envelope', range: '0 – 4',
    desc: 'Note length multiplier. 1 = fills entire step, 0.5 = staccato, 2 = overlapping.',
    tip: 'Values below 1 create gaps between notes; above 1 creates overlap.' },
  { key: 'clip', label: 'Clip', category: 'envelope', range: '0 – 4',
    desc: 'Clips the note length. Similar to legato but without retriggering overlap.',
    tip: 'Use for gated reverb effects combined with room.' },

  // ── Modulation ──
  { key: 'pan', label: 'Pan', category: 'modulation', range: '0 – 1',
    desc: '0 = hard left, 0.5 = center, 1 = hard right.',
    tip: 'Pattern it: .pan("0 1") alternates left-right per note.' },
  { key: 'detune', label: 'Detune', category: 'modulation', range: '0 – 4',
    desc: 'Adds a second oscillator slightly detuned. Creates thickness and width.',
    tip: '0.5-1 for gentle chorus, 2-3 for supersaw-style width.' },
  { key: 'speed', label: 'Speed', category: 'modulation', range: '0.1 – 4',
    desc: 'Playback speed of samples. 1 = normal, 2 = double speed/octave up, 0.5 = half.',
    tip: 'Negative values play in reverse: .speed(-1)' },
  { key: 'vib', label: 'Vibrato Rate', category: 'modulation', range: '0 – 12', unit: 'Hz',
    desc: 'Speed of pitch vibrato modulation.',
    tip: '4-6 Hz is natural singing vibrato; 0.5-2 for slow wobble.' },
  { key: 'vibmod', label: 'Vibrato Depth', category: 'modulation', range: '0 – 12',
    desc: 'Depth of pitch vibrato in semitones (roughly).',
    tip: '1-3 for subtle, 6+ for dramatic wow/whammy effect.' },
  { key: 'phaser', label: 'Phaser Rate', category: 'modulation', range: '0 – 12', unit: 'Hz',
    desc: 'Speed of phaser sweep. Creates sweeping comb filter effect.',
    tip: '0.5-2 for gentle sweep, 4+ for fast jet-engine sound.' },
  { key: 'phaserdepth', label: 'Phaser Depth', category: 'modulation', range: '0 – 1',
    desc: 'How deep the phaser notches sweep.',
    tip: 'Full depth (0.8-1) for dramatic sweeps; 0.3-0.5 for subtle movement.' },
  { key: 'phasercenter', label: 'Phaser Center', category: 'modulation', range: '100 – 8 000', unit: 'Hz',
    desc: 'Center frequency around which the phaser sweeps.' },
  { key: 'phasersweep', label: 'Phaser Sweep', category: 'modulation', range: '0 – 4 000',
    desc: 'Range of the phaser sweep in Hz.' },

  // ── FM Synthesis ──
  { key: 'fm', label: 'FM Amount', category: 'fm', range: '0 – 32',
    desc: 'Frequency modulation depth. Adds harmonics/overtones to the sound.',
    tip: '1-4 for bells/keys, 6-12 for metallic, 16+ for extreme inharmonic tones.' },
  { key: 'fmh', label: 'FM Harmonic', category: 'fm', range: '0.1 – 12',
    desc: 'Ratio of modulator to carrier frequency. Integer values produce harmonic tones.',
    tip: 'Integer ratios (1, 2, 3) = harmonic. Non-integer (1.414, 1.618) = metallic/bell.' },
  { key: 'fmattack', label: 'FM Attack', category: 'fm', range: '0 – 1', unit: 's',
    desc: 'Attack time of the FM modulation envelope.' },
  { key: 'fmdecay', label: 'FM Decay', category: 'fm', range: '0 – 1', unit: 's',
    desc: 'Decay time of FM modulation. Short = percussive FM, long = sustained harmonics.',
    tip: 'Short (0.05-0.15) for bells, longer (0.3+) for evolving textures.' },
  { key: 'fmsustain', label: 'FM Sustain', category: 'fm', range: '0 – 1',
    desc: 'Sustain level of the FM modulation envelope.',
    tip: '0 = FM dies out (bell-like), 0.5 = partial sustain, 1 = constant FM.' },

  // ── Pitch Envelope ──
  { key: 'penv', label: 'Pitch Envelope', category: 'pitch', range: '-24 – 24', unit: 'semi',
    desc: 'Pitch sweep amount in semitones at note start. Positive = starts high, negative = starts low.',
    tip: 'Negative values (-12 to -24) for 808 kick drops. Positive (7-12) for laser zaps.' },
  { key: 'pattack', label: 'Pitch Attack', category: 'pitch', range: '0 – 1', unit: 's',
    desc: 'Attack time of the pitch envelope.' },
  { key: 'pdecay', label: 'Pitch Decay', category: 'pitch', range: '0 – 1', unit: 's',
    desc: 'How fast the pitch returns to normal. Short = instant snap, long = glide.',
    tip: '0.03-0.08 for drum hits, 0.1-0.3 for noticeable pitch sweeps.' },
  { key: 'prelease', label: 'Pitch Release', category: 'pitch', range: '0 – 1', unit: 's',
    desc: 'Release time of the pitch envelope after note-off.' },
  { key: 'pcurve', label: 'Pitch Curve', category: 'pitch', range: '0 – 1',
    desc: 'Shape of the pitch decay curve. 0 = linear, 1 = exponential (snappier).',
    tip: 'Exponential (1) sounds more natural for kicks and zaps.' },
  { key: 'panchor', label: 'Pitch Anchor', category: 'pitch', range: '0 – 1',
    desc: 'Anchor point for the pitch envelope sweep.' },

  // ── Tremolo / AM ──
  { key: 'tremolosync', label: 'Tremolo Speed', category: 'tremolo', range: '0.5 – 32',
    desc: 'Tremolo rate synced to beat cycles. 1 = one cycle per beat, 4 = four per beat.',
    tip: '1 = sidechain pump feel, 4-8 = choppy gate, 0.25-0.5 = slow pulse.' },
  { key: 'tremolodepth', label: 'Tremolo Depth', category: 'tremolo', range: '0 – 1',
    desc: 'How deep the volume modulation goes. 1 = fully muted at troughs.',
    tip: '0.2-0.3 for gentle pulse, 0.7-1.0 for hard gating/pumping.' },
  { key: 'tremoloskew', label: 'Tremolo Skew', category: 'tremolo', range: '0 – 1',
    desc: 'Shifts the tremolo phase. Higher = faster attack, longer release.',
    tip: 'Set to 0.8-0.9 to simulate sidechain compression shape.' },
  { key: 'tremolophase', label: 'Tremolo Phase', category: 'tremolo', range: '0 – 1',
    desc: 'Phase offset of the tremolo. 0.25 = quarter cycle offset.',
    tip: 'Offset left/right channels for auto-pan: use with pan.' },
  { key: 'tremoloshape', label: 'Tremolo Shape', category: 'tremolo', range: '0 – 4',
    desc: 'Waveform shape of tremolo. 0 = sine (smooth), 1 = square (hard gate), 2+ = other.',
    tip: 'Square (1) for rhythmic gating; sine (0) for smooth volume swells.' },

  // ── Sample ──
  { key: 'loopAt', label: 'Loop At', category: 'sample', range: '1 – 64',
    desc: 'Loops sample to fit N cycles. Essential for making samples sync to tempo.',
    tip: '.loopAt(4) = sample spans 4 beats. Use with .fit() for pitch-correct looping.' },
  { key: 'loop', label: 'Loop On/Off', category: 'sample', range: '0 or 1',
    desc: 'Enables sample looping. 1 = loop continuously.',
    tip: 'Combine with loopBegin/loopEnd for partial loop regions.' },
  { key: 'begin', label: 'Begin', category: 'sample', range: '0 – 1',
    desc: 'Start playback position within the sample. 0 = start, 0.5 = halfway.',
    tip: 'Pattern it: .begin("0 0.25 0.5 0.75") to play different sections.' },
  { key: 'end', label: 'End', category: 'sample', range: '0 – 1',
    desc: 'End playback position within the sample. 1 = full sample.',
    tip: 'Combine with begin for sample slicing: .begin(.25).end(.5)' },
  { key: 'chop', label: 'Chop', category: 'sample', range: '1 – 64',
    desc: 'Cuts sample into N equal pieces and plays them in order across the pattern.',
    tip: 'Classic breakbeat technique: .chop(8) on a drum loop.' },
  { key: 'stretch', label: 'Stretch', category: 'sample', range: '0.25 – 4',
    desc: 'Time-stretches the sample without changing pitch.',
    tip: 'Values other than 1 create granular artifacts — can be a creative effect!' },
  { key: 'slice', label: 'Slice', category: 'sample', range: '2 – 64',
    desc: 'Divides sample into N slices and rearranges them by index pattern.',
    tip: '.slice(8, "0 4 2 6 1 5 3 7") for jungle-style rearrangement.' },
  { key: 'splice', label: 'Splice', category: 'sample', range: '2 – 64',
    desc: 'Same as slice but auto-adjusts pitch of each slice to match original.',
    tip: 'Better for melodic content where pitch accuracy matters.' },
  { key: 'striate', label: 'Striate', category: 'sample', range: '2 – 64',
    desc: 'Granular effect — overlays multiple sample grains offset in time.',
    tip: 'Creates washy, granular textures. Higher values = finer grains.' },
  { key: 'fit', label: 'Fit', category: 'sample', range: 'no args',
    desc: 'Stretches sample to fit one cycle without pitch change.',
    tip: 'Use for long samples that need to sync to tempo: s("break").fit()' },
  { key: 'scrub', label: 'Scrub', category: 'sample', range: '0 – 1',
    desc: 'Manual playback position — scrubs through the sample.',
    tip: 'Pattern it for turntable effects: .scrub(sine.range(0, 1))' },
  { key: 'loopBegin', label: 'Loop Begin', category: 'sample', range: '0 – 1',
    desc: 'Start position of the looped region within the sample.' },
  { key: 'loopEnd', label: 'Loop End', category: 'sample', range: '0 – 1',
    desc: 'End position of the looped region within the sample.' },
  { key: 'cut', label: 'Cut Group', category: 'sample', range: '0 – 16',
    desc: 'Assigns sample to a cut group — new notes in same group cut previous ones.',
    tip: 'Essential for hihat choke: open and closed hats in the same cut group.' },
  { key: 'n', label: 'Sample Number', category: 'sample', range: '0 – 127',
    desc: 'Selects which sample number from a sample bank to play.',
    tip: 'Pattern it: .n("0 2 4 6") to cycle through different samples.' },
  { key: 'hurry', label: 'Hurry', category: 'sample', range: '0.25 – 8',
    desc: 'Changes both speed and rate — like speeding up a turntable.',
    tip: '2 = double speed (octave up), 0.5 = half speed (octave down).' },
  { key: 'unit', label: 'Unit', category: 'sample', range: '"r", "c", "s"',
    desc: 'Sets the speed unit. "r" = ratio, "c" = cycles per step, "s" = seconds per step.',
    tip: 'Use "c" with .unit("c").speed(1) to make 1 cycle = 1 step length.' },

  // ── Dynamics ──
  { key: 'compressor', label: 'Compressor', category: 'dynamics', range: '-60 – 0 dB',
    desc: 'Applies dynamic range compression. Takes threshold, ratio, knee, attack, release.',
    tip: 'Light: .compressor("-10:12:10:.005:.1") Heavy: .compressor("-25:30:6:.001:.02")' },

  // ── Pattern ──
  { key: 'fast', label: 'Fast', category: 'pattern', range: '0.25 – 16',
    desc: 'Speeds up the pattern by a factor. 2 = double speed (plays pattern twice per cycle).',
    tip: 'Use for fills: .fast(2) doubles the rhythm.' },
  { key: 'slow', label: 'Slow', category: 'pattern', range: '0.25 – 16',
    desc: 'Slows the pattern by a factor. 2 = half speed (pattern spans 2 cycles).',
    tip: 'Combine with fast for polyrhythms.' },
  { key: 'jux', label: 'Jux', category: 'pattern', range: 'function',
    desc: 'Applies a function to one stereo channel only. Creates stereo interest.',
    tip: '.jux(rev) reverses right channel — instant stereo width.' },
  { key: 'off', label: 'Off', category: 'pattern', range: 'offset, function',
    desc: 'Overlays a delayed, transformed copy of the pattern.',
    tip: '.off(1/8, x => x.add(7)) creates an offset fifth harmony.' },
  { key: 'superimpose', label: 'Superimpose', category: 'pattern', range: 'function',
    desc: 'Overlays a transformed copy on top of the original pattern.',
    tip: '.superimpose(x => x.add(12).slow(2)) adds an octave-up half-speed layer.' },
  { key: 'echo', label: 'Echo', category: 'pattern', range: 'repeats, time, feedback',
    desc: 'Creates rhythmic echoes with decaying volume.',
    tip: '.echo(3, 1/8, 0.5) = 3 echoes every 8th note at 50% decay.' },
  { key: 'ply', label: 'Ply', category: 'pattern', range: '1 – 16',
    desc: 'Multiplies each note, playing it N times in its time slot.',
    tip: '.ply(2) turns each note into a double-hit.' },

  // ── Gain / Level ──
  { key: 'gain', label: 'Gain', category: 'gain', range: '0 – 2',
    desc: 'Volume multiplier. 1 = original, 0 = silent, 2 = double volume.',
    tip: 'Pattern it for accents: .gain("1 .5 .8 .5")' },
  { key: 'velocity', label: 'Velocity', category: 'gain', range: '0 – 1',
    desc: 'Note velocity controlling volume and often timbre.',
    tip: 'Lower values create soft, gentle dynamics.' },
  { key: 'postgain', label: 'Post Gain', category: 'gain', range: '0 – 4',
    desc: 'Volume applied after all effects. Use for final level adjustment.',
    tip: 'Use to compensate for volume loss from filtering or effects.' },
]

// ─── Component ─────────────────────────────────────────────────

interface EffectsDocModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function EffectsDocModal({ isOpen, onClose }: EffectsDocModalProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<EffectDocCategory | 'all'>('all')

  const filtered = useMemo(() => {
    let list = EFFECTS_DOCS
    if (activeCategory !== 'all') list = list.filter(e => e.category === activeCategory)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.key.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.desc.toLowerCase().includes(q) ||
        e.tip?.toLowerCase().includes(q)
      )
    }
    return list
  }, [search, activeCategory])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div
        className="bg-gray-900 border border-purple-500/30 rounded-xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-xl">📖</span> Effects Reference
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl font-bold px-2">✕</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-800">
          <input
            type="text"
            placeholder="Search effects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-purple-500"
            autoFocus
          />
        </div>

        {/* Category tabs */}
        <div className="px-5 py-2 border-b border-gray-800 overflow-x-auto flex gap-1.5 scrollbar-thin">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
              activeCategory === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >All ({EFFECTS_DOCS.length})</button>
          {CATEGORY_META.map(c => {
            const count = EFFECTS_DOCS.filter(e => e.category === c.key).length
            return (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                  activeCategory === c.key ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
                style={activeCategory === c.key ? { background: c.color } : {}}
              >
                {c.icon} {c.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Effects list */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {filtered.length === 0 && (
            <p className="text-gray-500 text-center py-8">No effects match your search.</p>
          )}
          {filtered.map(effect => {
            const cat = CATEGORY_META.find(c => c.key === effect.category)
            return (
              <div
                key={effect.key}
                className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono font-bold text-purple-300">.{effect.key}()</span>
                      <span className="text-xs text-gray-500">{effect.label}</span>
                      {cat && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: cat.color + '30', color: cat.color }}>
                          {cat.icon} {cat.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed">{effect.desc}</p>
                    {effect.tip && (
                      <p className="text-xs text-cyan-400/80 mt-1 leading-relaxed">💡 {effect.tip}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-[10px] text-gray-500">Range</span>
                    <div className="text-xs font-mono text-yellow-300/80">{effect.range}{effect.unit ? ` ${effect.unit}` : ''}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-gray-800 text-center">
          <span className="text-[10px] text-gray-600">
            {filtered.length} of {EFFECTS_DOCS.length} effects • Strudel live-coding reference
          </span>
        </div>
      </div>
    </div>
  )
}
