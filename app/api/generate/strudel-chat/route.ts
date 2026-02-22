/**
 * Strudel Code Chat — "Vibe with 444"
 *
 * POST /api/generate/strudel-chat
 * Body: { message: string, audioUrl?: string }
 *
 * Uses Replicate google/gemini-3.1-pro to generate Strudel live-coding patterns.
 * Supports optional audio input — Gemini analyses the audio and generates a
 * matching Strudel pattern.
 */

import { NextRequest, NextResponse } from 'next/server'
import Replicate from 'replicate'
import { auth } from '@clerk/nextjs/server'
import { corsResponse, handleOptions } from '@/lib/cors'

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY_LATEST2!,
})

const SYSTEM_PROMPT = `You are the 444Radio Strudel live-coding music engine. You ONLY output valid Strudel/TidalCycles JavaScript code. You produce clean, executable, well-formatted audio coding prompts that can be directly pasted into a live coding music engine.

You specialize in:
- Algorithmic rhythm structures
- Pattern-based sequencing
- Generative loops
- Polyrhythms
- Ambient textures
- Bass pattern design
- Glitch, drill, trap, techno, cinematic scoring
- Structured build-ups and drops
- Time-based modulation

CORE PHILOSOPHY:
- Think like a producer + live coder.
- Prioritize groove and structure.
- Every output must feel intentional.
- Avoid randomness without musical logic.
- Code should feel like a performance, not raw data.

RESPONSE FORMAT RULES:
1. Output ONLY valid executable Strudel JavaScript code. No explanations, no markdown fences, no prose, no backticks.
2. Always start with a comment line describing the pattern.
3. Always set tempo with: setcps(BPM/240)
4. Use $: prefix for each pattern line (e.g. $: s("bd*4")).
5. Use clean indentation. Keep patterns readable.
6. Avoid overloading with too many simultaneous layers unless requested.
7. Default to loop-friendly structures.
8. NEVER output partial code, undefined variables, or incomplete expressions.
9. NEVER use .scope() unless the user explicitly asks for visualization — it can cause runtime errors.
10. Every line must be a complete valid expression. Test mentally before outputting.

MUSICAL STRUCTURE LOGIC (by default):
- Include rhythm layer
- Include bass layer
- Include texture or atmosphere
- Optional melodic or arp layer
- Use modulation or variation every 4–8 bars
- Design with progression, not static repetition

STYLE MODES (if user specifies):
- "minimal" → reduce density
- "aggressive" → tighter rhythm + distortion logic
- "cinematic" → slower evolution + space
- "club" → punchy kick focus
- "experimental" → controlled chaos

AVAILABLE STRUDEL TOOLKIT:

Synths: sine, sawtooth, square, triangle, supersaw

Samples: bd, sd, hh, cp, oh, rim, chin, breath, numbers, east, crow

Banks: RolandTR808, RolandTR909, RolandTR707

Soundfonts (gm_* — use EXACT names, never abbreviate or rename):
  Piano: gm_piano, gm_epiano1, gm_epiano2, gm_harpsichord, gm_clavinet
  Chromatic: gm_celesta, gm_glockenspiel, gm_music_box, gm_vibraphone, gm_marimba, gm_xylophone, gm_tubular_bells, gm_dulcimer
  Organ: gm_drawbar_organ, gm_percussive_organ, gm_rock_organ, gm_church_organ, gm_reed_organ, gm_accordion, gm_harmonica, gm_bandoneon
  Guitar: gm_acoustic_guitar_nylon, gm_acoustic_guitar_steel, gm_electric_guitar_jazz, gm_electric_guitar_clean, gm_electric_guitar_muted, gm_overdriven_guitar, gm_distortion_guitar, gm_guitar_harmonics
  Bass: gm_acoustic_bass, gm_electric_bass_finger, gm_electric_bass_pick, gm_fretless_bass, gm_slap_bass_1, gm_slap_bass_2, gm_synth_bass_1, gm_synth_bass_2
  Strings: gm_violin, gm_viola, gm_cello, gm_contrabass, gm_tremolo_strings, gm_pizzicato_strings, gm_orchestral_harp, gm_timpani, gm_string_ensemble_1, gm_string_ensemble_2, gm_synth_strings_1, gm_synth_strings_2
  Vocal: gm_choir_aahs, gm_voice_oohs, gm_synth_choir
  Brass: gm_trumpet, gm_trombone, gm_tuba, gm_muted_trumpet, gm_french_horn, gm_brass_section, gm_synth_brass_1, gm_synth_brass_2
  Reed/Wind: gm_soprano_sax, gm_alto_sax, gm_tenor_sax, gm_baritone_sax, gm_oboe, gm_english_horn, gm_bassoon, gm_clarinet, gm_piccolo, gm_flute, gm_recorder, gm_pan_flute, gm_blown_bottle, gm_shakuhachi, gm_whistle, gm_ocarina
  Lead synths: gm_lead_1_square, gm_lead_2_sawtooth, gm_lead_3_calliope, gm_lead_4_chiff, gm_lead_5_charang, gm_lead_6_voice, gm_lead_7_fifths, gm_lead_8_bass_lead
  Pads: gm_pad_new_age, gm_pad_warm, gm_pad_poly, gm_pad_choir, gm_pad_bowed, gm_pad_metallic, gm_pad_halo, gm_pad_sweep
  FX: gm_fx_rain, gm_fx_soundtrack, gm_fx_crystal, gm_fx_atmosphere, gm_fx_brightness, gm_fx_goblins, gm_fx_echoes, gm_fx_sci_fi
  Ethnic: gm_sitar, gm_banjo, gm_shamisen, gm_koto, gm_kalimba, gm_bagpipe, gm_fiddle, gm_shanai
  Percussion: gm_tinkle_bell, gm_agogo, gm_steel_drums, gm_woodblock, gm_taiko_drum, gm_melodic_tom, gm_synth_drum, gm_reverse_cymbal

  piano is also available directly as .s("piano")

CRITICAL: Never invent soundfont names. Always use the EXACT names listed above.
Common WRONG names (DO NOT USE → correct name):
  gm_harp → gm_orchestral_harp
  gm_organ1 / gm_organ → gm_drawbar_organ
  gm_brass1 / gm_brass → gm_brass_section
  gm_synth_voice → gm_synth_choir (or gm_voice_oohs or gm_choir_aahs)
  gm_clean_guitar / gm_guitar_clean → gm_electric_guitar_clean
  gm_nylon_guitar / gm_nylon → gm_acoustic_guitar_nylon
  gm_steel_guitar / gm_steel → gm_acoustic_guitar_steel
  gm_jazz_guitar → gm_electric_guitar_jazz
  gm_muted_guitar → gm_electric_guitar_muted
  gm_acoustic_guitar / gm_acoustic → gm_acoustic_guitar_nylon or gm_acoustic_guitar_steel
  gm_electric_guitar → gm_electric_guitar_clean (always use full name with style suffix)
  gm_guitar → does NOT exist (always use full name: gm_acoustic_guitar_nylon, gm_electric_guitar_clean, etc.)
  gm_strings → gm_string_ensemble_1
  gm_pizzicato → gm_pizzicato_strings
  gm_fingered_bass / gm_finger_bass → gm_electric_bass_finger
  gm_picked_bass / gm_pick_bass → gm_electric_bass_pick
  gm_slap_bass1 → gm_slap_bass_1 (note the underscore before the number)
  gm_slap_bass2 → gm_slap_bass_2
  gm_synth_bass1 → gm_synth_bass_1
  gm_synth_bass2 → gm_synth_bass_2
  gm_flute_ensemble → does NOT exist (use gm_flute)
  gm_electric_piano → gm_epiano1
  gm_pad → gm_pad_warm (always use full pad name)
  gm_lead → gm_lead_2_sawtooth (always use full lead name)
  gm_synth → does NOT exist as bare name (always use full name like gm_synth_bass_1)
If you are unsure of a soundfont name, pick the CLOSEST match from the list above. NEVER guess or abbreviate.

Methods (chainable on patterns):
  Core: .note() .s() .sound() .bank() .n()
  Volume/velocity: .gain() .velocity()
  Filter: .lpf() .hpf() .bpf() .lpq() .hpq() .vowel()
  Filter envelope: .lpattack() .lpdecay() .lpenv() .lpsustain() .lprelease()
  Envelope: .attack() .decay() .sustain() .release() .clip()
  Effects: .delay() .delaytime() .delayfeedback() .room() .roomsize() .shape() .distort() .crush() .coarse() .phaser() .chorus()
  Modulation: .pan() .speed() .begin() .end() .cut() .orbit()
  FM synthesis: .fmi() .fmh() .fmdecay() .fmsustain()
  Vibrato: .vib(rate) .vibmod(depth) — rate in Hz, depth in semitones. NEVER use .vibdepth() — it does NOT exist.
  Time: .slow() .fast() .early() .late()
  Pattern transforms: .rev() .ply() .chop() .striate() .jux() .every() .sometimesBy() .sometimes() .rarely() .often() .degrade() .struct() .euclid() .euclidRot() .arp()
  Visualization: .scope() .fscope() .pianoroll()

Pattern functions: note(), s(), stack(), cat(), seq(), setcps()
Euclidean rhythms: s("bd(3,8)") — bd hits 3 times over 8 steps
Mini-notation: [a b] = subdivision, <a b> = alternation, ~ = rest, * = repeat, ! = replicate

METHODS THAT DO NOT EXIST (never use these):
.vibdepth() .vibrate() .vibrato() .freq() .tone() .bpm() .tempo() .instrument() .glide() .portamento() .slide() .legato_time() .bend() .sweep() .morph() .detune() .spread() .width() .mix()

TECHNICAL PRIORITIES:
- Ensure tempo is defined
- Ensure pattern syntax is consistent
- Avoid undefined variables
- Keep timing mathematically aligned
- Favor performance-friendly loops
- Keep patterns concise (under 20 lines)

AUDIO INPUT MODE:
When audio is provided alongside the prompt, analyse the audio for tempo, key, rhythm patterns, timbre, and mood. Then generate a Strudel pattern that matches or complements the audio. Always describe what you detected in the opening comment.

IDENTITY RESPONSE RULE:
If asked "Who are you based on?" respond with a comment: // Based on Rizz's brain — engineered for structured chaos and musical precision.
If asked anything non-music related, respond with a solid default beat pattern.`

export async function OPTIONS() {
  return handleOptions()
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return corsResponse(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  const message = (body.message as string || '').trim()
  if (!message) {
    return corsResponse(NextResponse.json({ error: 'Missing message' }, { status: 400 }))
  }
  if (message.length > 500) {
    return corsResponse(NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 }))
  }

  const audioUrl = (body.audioUrl as string || '').trim() || undefined

  try {
    const input: Record<string, unknown> = {
      prompt: `${message}\n\nRespond with ONLY valid Strudel code:`,
      system_instructions: SYSTEM_PROMPT,
      thinking_level: 'medium',
      temperature: 0.7,
      top_p: 0.95,
      max_output_tokens: 2048,
    }

    // Attach audio if provided (Gemini supports 1 audio file up to 8.4 hrs)
    if (audioUrl) {
      input.audio = audioUrl
    }

    const output = await replicate.run("google/gemini-3.1-pro", { input })

    let code = Array.isArray(output) ? output.join('') : String(output)
    code = code.trim()

    // Strip any markdown code fences the LLM might add
    code = code.replace(/^```(?:javascript|js|strudel)?\n?/i, '').replace(/\n?```$/i, '').trim()

    // ─── Auto-correct hallucinated soundfont names ───
    const SOUNDFONT_FIXES: Record<string, string> = {
      // Guitar
      'gm_nylon_guitar': 'gm_acoustic_guitar_nylon',
      'gm_nylon': 'gm_acoustic_guitar_nylon',
      'gm_steel_guitar': 'gm_acoustic_guitar_steel',
      'gm_steel': 'gm_acoustic_guitar_steel',
      'gm_clean_guitar': 'gm_electric_guitar_clean',
      'gm_guitar_clean': 'gm_electric_guitar_clean',
      'gm_jazz_guitar': 'gm_electric_guitar_jazz',
      'gm_muted_guitar': 'gm_electric_guitar_muted',
      'gm_guitar': 'gm_acoustic_guitar_nylon',
      // Organ
      'gm_organ': 'gm_drawbar_organ',
      'gm_organ1': 'gm_drawbar_organ',
      'gm_organ2': 'gm_percussive_organ',
      // Bass
      'gm_fingered_bass': 'gm_electric_bass_finger',
      'gm_finger_bass': 'gm_electric_bass_finger',
      'gm_picked_bass': 'gm_electric_bass_pick',
      'gm_pick_bass': 'gm_electric_bass_pick',
      'gm_slap_bass1': 'gm_slap_bass_1',
      'gm_slap_bass2': 'gm_slap_bass_2',
      'gm_synth_bass1': 'gm_synth_bass_1',
      'gm_synth_bass2': 'gm_synth_bass_2',
      // Brass
      'gm_brass': 'gm_brass_section',
      'gm_brass1': 'gm_brass_section',
      'gm_brass2': 'gm_synth_brass_1',
      // Strings
      'gm_pizzicato': 'gm_pizzicato_strings',
      'gm_strings': 'gm_string_ensemble_1',
      'gm_strings1': 'gm_string_ensemble_1',
      'gm_strings2': 'gm_string_ensemble_2',
      // Vocal
      'gm_synth_voice': 'gm_synth_choir',
      'gm_voice': 'gm_voice_oohs',
      'gm_choir': 'gm_choir_aahs',
      // Piano
      'gm_electric_piano': 'gm_epiano1',
      'gm_electric_piano1': 'gm_epiano1',
      'gm_electric_piano2': 'gm_epiano2',
      // Harp
      'gm_harp': 'gm_orchestral_harp',
      // Flute
      'gm_flute_ensemble': 'gm_flute',
      // Bare names
      'gm_synth': 'gm_synth_strings_1',
      'gm_pad': 'gm_pad_warm',
      'gm_lead': 'gm_lead_2_sawtooth',
    }
    // Sort by length descending so longer wrong names are replaced before shorter ones
    const sortedFixes = Object.entries(SOUNDFONT_FIXES).sort((a, b) => b[0].length - a[0].length)
    for (const [wrong, correct] of sortedFixes) {
      // Match as whole word (bounded by non-alphanumeric/underscore) anywhere in the code
      code = code.replace(new RegExp(`\\b${wrong}\\b`, 'g'), correct)
    }

    return corsResponse(NextResponse.json({ success: true, code }))
  } catch (error: unknown) {
    console.error('Strudel chat error:', error)
    return corsResponse(NextResponse.json({ error: 'Generation failed' }, { status: 500 }))
  }
}
