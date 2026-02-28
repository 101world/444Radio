'use client'

import { useEffect, useRef } from 'react'

interface MatrixConsoleProps {
  isGenerating?: boolean
  isPlaying?: boolean
  isProMode?: boolean
}

// ─── Pixel art sprite definitions (5 band members) ──────────────
// Each sprite is a 2D array: rows of pixel columns
// 0=transparent, 1=body, 2=highlight/instrument, 3=skin, 4=accent

const PIXEL = 3 // pixel size

// Drummer (with sticks up/down)
const DRUMMER_A = [
  [0,0,0,3,3,0,0,0],
  [0,0,3,3,3,3,0,0],
  [0,0,0,3,3,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,2,1,1,1,1,2,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,1,0,0,1,0,0],
  [0,0,1,0,0,1,0,0],
]
const DRUMMER_B = [
  [0,0,0,3,3,0,0,0],
  [0,0,3,3,3,3,0,0],
  [0,0,0,3,3,0,0,0],
  [0,0,1,1,1,1,0,0],
  [2,0,1,1,1,1,0,2],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,1,0,0,1,0,0],
  [0,0,1,0,0,1,0,0],
]

// Guitarist (strumming)
const GUITAR_A = [
  [0,0,3,3,0,0,0,0],
  [0,3,3,3,3,0,0,0],
  [0,0,3,3,0,0,0,0],
  [0,1,1,1,1,0,0,0],
  [0,1,1,1,2,2,0,0],
  [0,1,1,2,2,2,2,0],
  [0,0,1,1,2,0,0,0],
  [0,1,0,0,1,0,0,0],
  [0,1,0,0,1,0,0,0],
]
const GUITAR_B = [
  [0,0,3,3,0,0,0,0],
  [0,3,3,3,3,0,0,0],
  [0,0,3,3,0,0,0,0],
  [0,1,1,1,1,0,0,0],
  [0,1,1,2,2,2,0,0],
  [0,1,2,2,2,2,0,0],
  [0,0,1,2,1,0,0,0],
  [0,1,0,0,1,0,0,0],
  [0,1,0,0,1,0,0,0],
]

// Singer (mouth open/closed, arm up/down)
const SINGER_A = [
  [0,0,3,3,0,0,0],
  [0,3,3,3,3,0,0],
  [0,0,3,4,0,0,0],
  [0,1,1,1,1,0,0],
  [0,1,1,1,1,2,0],
  [0,1,1,1,1,2,0],
  [0,0,1,1,0,0,0],
  [0,1,0,0,1,0,0],
  [0,1,0,0,1,0,0],
]
const SINGER_B = [
  [0,0,3,3,0,0,0],
  [0,3,3,3,3,0,0],
  [0,0,4,4,0,0,0],
  [0,1,1,1,1,0,0],
  [2,1,1,1,1,0,0],
  [0,1,1,1,1,0,0],
  [0,0,1,1,0,0,0],
  [0,1,0,0,1,0,0],
  [0,1,0,0,1,0,0],
]

// Bassist (plucking)
const BASS_A = [
  [0,0,0,3,3,0,0,0],
  [0,0,3,3,3,3,0,0],
  [0,0,0,3,3,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,0,1,1,1,2,2,0],
  [0,0,1,1,2,2,2,2],
  [0,0,0,1,1,2,0,0],
  [0,0,1,0,0,1,0,0],
  [0,0,1,0,0,1,0,0],
]
const BASS_B = [
  [0,0,0,3,3,0,0,0],
  [0,0,3,3,3,3,0,0],
  [0,0,0,3,3,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,0,1,1,2,2,0,0],
  [0,0,1,2,2,2,2,0],
  [0,0,0,1,2,1,0,0],
  [0,0,1,0,0,1,0,0],
  [0,0,1,0,0,1,0,0],
]

// Keys/Synth player
const KEYS_A = [
  [0,0,3,3,0,0,0,0],
  [0,3,3,3,3,0,0,0],
  [0,0,3,3,0,0,0,0],
  [0,1,1,1,1,0,0,0],
  [0,1,1,1,1,0,0,0],
  [0,2,1,1,2,0,0,0],
  [2,2,2,2,2,2,2,0],
  [0,1,0,0,1,0,0,0],
  [0,1,0,0,1,0,0,0],
]
const KEYS_B = [
  [0,0,3,3,0,0,0,0],
  [0,3,3,3,3,0,0,0],
  [0,0,3,3,0,0,0,0],
  [0,1,1,1,1,0,0,0],
  [0,1,1,1,1,0,0,0],
  [2,0,1,1,0,2,0,0],
  [2,2,2,2,2,2,2,0],
  [0,1,0,0,1,0,0,0],
  [0,1,0,0,1,0,0,0],
]

// Band member colors per character type
const BAND_COLORS: Record<number, string[]> = {
  // [idle, active] per pixel value
  // 0 = transparent
  // 1 = body
  // 2 = instrument/highlight
  // 3 = skin
  // 4 = accent (mouth)
}

function getPixelColor(val: number, memberIdx: number, _active: boolean): string {
  const bodyColors = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6']
  const instrColors = ['#22d3ee', '#f472b6', '#34d399', '#fbbf24', '#a78bfa']
  switch (val) {
    case 1: return bodyColors[memberIdx % 5]
    case 2: return instrColors[memberIdx % 5]
    case 3: return '#f5d0a9'
    case 4: return '#ef4444'
    default: return ''
  }
}

// ─── Drum kit sprite (behind drummer) ─────────────────────
const DRUM_KIT = [
  [0,0,0,0,0,0,0,0,0,0],
  [0,0,2,2,2,2,2,2,0,0],
  [0,2,2,2,2,2,2,2,2,0],
  [0,2,2,0,0,0,0,2,2,0],
  [0,0,2,2,2,2,2,2,0,0],
]

// ─── Stage / floor pattern ─────────────────────────
function drawStage(ctx: CanvasRenderingContext2D, w: number, h: number, stageY: number) {
  // Dark stage floor
  const grad = ctx.createLinearGradient(0, stageY, 0, h)
  grad.addColorStop(0, '#1a1a2e')
  grad.addColorStop(1, '#0a0a14')
  ctx.fillStyle = grad
  ctx.fillRect(0, stageY, w, h - stageY)

  // Stage edge line with glow
  const proActive = typeof window !== 'undefined' && document.documentElement.classList.contains('pro-mode-active')
  ctx.strokeStyle = proActive ? 'rgba(255, 0, 0, 0.4)' : 'rgba(34, 211, 238, 0.3)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, stageY)
  ctx.lineTo(w, stageY)
  ctx.stroke()
}

// ─── Spotlight beams ─────────────────────────
function drawSpotlights(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const spotCount = 3
  for (let i = 0; i < spotCount; i++) {
    const x = (w / (spotCount + 1)) * (i + 1)
    const sway = Math.sin(t * 0.001 + i * 2.1) * 30
    const grad = ctx.createLinearGradient(x + sway, 0, x, h * 0.7)
    const hue = [180, 280, 330][i]
    grad.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.12)`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x + sway - 20, 0)
    ctx.lineTo(x - 60, h * 0.7)
    ctx.lineTo(x + 60, h * 0.7)
    ctx.lineTo(x + sway + 20, 0)
    ctx.fill()
  }
}

// ─── Music note particles ─────────────────────────
interface NoteParticle {
  x: number; y: number; vy: number; vx: number
  char: string; opacity: number; size: number
}

export default function MatrixConsole({ isGenerating = false, isPlaying = false, isProMode = false }: MatrixConsoleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isGenRef = useRef(isGenerating)
  const isPlayRef = useRef(isPlaying)
  const isProRef = useRef(isProMode)

  useEffect(() => {
    isGenRef.current = isGenerating
  }, [isGenerating])

  useEffect(() => {
    isPlayRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    isProRef.current = isProMode
  }, [isProMode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dpr = window.devicePixelRatio || 1
    const resize = () => {
      dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
    }
    resize()
    window.addEventListener('resize', resize)

    const W = () => canvas.offsetWidth
    const H = () => canvas.offsetHeight

    // ─── Matrix rain state ─────────────────
    const fontSize = 12
    let columns = Math.floor(W() / fontSize)
    let drops: number[] = new Array(columns).fill(0).map(() => Math.random() * -100)
    const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ♪♫♬'

    const gpuLogs = [
      'GPU:0 CUDA cores: 10752 active',
      'VRAM: 47.2GB / 48GB allocated',
      'Batch inference: 128 samples/s',
      'Tensor RT: optimized fp16 mode',
      'Denoising step 42/50 σ=0.031',
      'Waveform synthesis: 44.1kHz/24bit',
      'FFT transform: 2048 bins ready',
      'Neural codec: 48kbps encoding',
      'Spectrogram: mel-128 computed',
      'Vocoder pass: HiFi-GAN v2',
      'Pipeline: diffusion active',
      'Loss: 0.00234 | Step: 8042',
      '✦ rizz is everything ✦',
      '♫ 444 vibe activated',
      '⚡ vibe with 444',
      '→ generate a track now',
      '◉ the algorithm chose you',
      '☽ midnight frequency locked',
      '✧ ears blessed loading...',
      '♪ your next hit starts here',
      '∞ infinite loops unlocked',
      '⟐ sonic dimension: entered',
      '△ wavelength: immaculate',
      '☆ drop incoming in 3.. 2..',
      '✦ vibes: unmatched',
      '◇ 444 radio: always on',
      '⚙ beats per rizz: maximum',
      '♬ lowkey this slaps already',
    ]
    let logLines: { text: string; y: number; opacity: number; speed: number }[] = []
    let lastLogTime = 0

    // ─── Pixel band state ─────────────────
    const bandSprites = [
      [DRUMMER_A, DRUMMER_B],
      [GUITAR_A, GUITAR_B],
      [SINGER_A, SINGER_B],
      [BASS_A, BASS_B],
      [KEYS_A, KEYS_B],
    ]
    let noteParticles: NoteParticle[] = []
    const noteChars = ['♪', '♫', '♬', '♩', '𝅘𝅥𝅮']
    let lastNoteTime = 0

    // bounce offsets per band member
    const bouncePhases = [0, 0.8, 1.6, 2.4, 3.2]

    let animFrame: number

    const draw = () => {
      const w = W()
      const h = H()
      const t = Date.now()

      ctx.save()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const generating = isGenRef.current

      if (generating) {
        // ═══════════════════════════════════════
        //  PIXEL BAND MODE
        // ═══════════════════════════════════════
        ctx.fillStyle = '#08080f'
        ctx.fillRect(0, 0, w, h)

        const stageY = h * 0.55
        drawStage(ctx, w, h, stageY)
        drawSpotlights(ctx, w, h, t)

        // Draw band members
        const bandWidth = w * 0.85
        const startX = (w - bandWidth) / 2
        const memberSpacing = bandWidth / 5

        for (let m = 0; m < 5; m++) {
          const frame = Math.floor(t / 350) % 2
          const sprite = bandSprites[m][frame]
          const cx = startX + memberSpacing * m + memberSpacing / 2
          const bounce = Math.sin(t * 0.005 + bouncePhases[m]) * 3
          const spriteW = sprite[0].length * PIXEL
          const spriteH = sprite.length * PIXEL
          const sx = cx - spriteW / 2
          const sy = stageY - spriteH - 6 + bounce

          // Glow under each member
          const glowGrad = ctx.createRadialGradient(cx, stageY, 0, cx, stageY, 25)
          const glowColors = ['rgba(99,102,241,0.15)', 'rgba(236,72,153,0.15)', 'rgba(20,184,166,0.15)', 'rgba(245,158,11,0.15)', 'rgba(139,92,246,0.15)']
          glowGrad.addColorStop(0, glowColors[m])
          glowGrad.addColorStop(1, 'transparent')
          ctx.fillStyle = glowGrad
          ctx.fillRect(cx - 30, stageY - 5, 60, 10)

          // Draw drum kit behind drummer
          if (m === 0) {
            for (let r = 0; r < DRUM_KIT.length; r++) {
              for (let c = 0; c < DRUM_KIT[r].length; c++) {
                if (DRUM_KIT[r][c] > 0) {
                  ctx.fillStyle = 'rgba(100, 116, 139, 0.6)'
                  ctx.fillRect(
                    sx - PIXEL + c * PIXEL,
                    sy + spriteH - DRUM_KIT.length * PIXEL + r * PIXEL + PIXEL * 2,
                    PIXEL - 1,
                    PIXEL - 1
                  )
                }
              }
            }
          }

          // Draw sprite pixels
          for (let r = 0; r < sprite.length; r++) {
            for (let c = 0; c < sprite[r].length; c++) {
              const val = sprite[r][c]
              if (val === 0) continue
              const color = getPixelColor(val, m, true)
              ctx.fillStyle = color
              ctx.fillRect(sx + c * PIXEL, sy + r * PIXEL, PIXEL - 1, PIXEL - 1)
            }
          }

          // Member label
          const labels = ['DRUMS', 'GUITAR', 'VOCALS', 'BASS', 'KEYS']
          ctx.fillStyle = 'rgba(255,255,255,0.25)'
          ctx.font = '7px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(labels[m], cx, stageY + 14)
          ctx.textAlign = 'start'
        }

        // ─── Music note particles ─────────────
        if (t - lastNoteTime > 300 + Math.random() * 400) {
          const mx = startX + Math.random() * bandWidth
          noteParticles.push({
            x: mx,
            y: stageY - 40 - Math.random() * 20,
            vy: -0.4 - Math.random() * 0.6,
            vx: (Math.random() - 0.5) * 0.5,
            char: noteChars[Math.floor(Math.random() * noteChars.length)],
            opacity: 1,
            size: 10 + Math.random() * 8,
          })
          lastNoteTime = t
        }

        noteParticles = noteParticles.filter(p => {
          p.y += p.vy
          p.x += p.vx
          p.opacity -= 0.008
          if (p.opacity <= 0) return false

          ctx.fillStyle = isProRef.current
            ? `rgba(255, 0, 0, ${p.opacity * 0.8})`
            : `rgba(34, 211, 238, ${p.opacity * 0.8})`
          ctx.font = `${p.size}px monospace`
          ctx.fillText(p.char, p.x, p.y)
          return true
        })

        // ─── Scrolling GPU logs at very bottom (subtle) ─────
        if (t - lastLogTime > 1000 + Math.random() * 1500) {
          const text = gpuLogs[Math.floor(Math.random() * gpuLogs.length)]
          logLines.push({
            text: `[${new Date().toLocaleTimeString()}] ${text}`,
            y: h - 6,
            opacity: 0.5,
            speed: 0.2,
          })
          lastLogTime = t
        }
        ctx.font = '8px monospace'
        logLines = logLines.filter(line => {
          line.y -= line.speed
          line.opacity -= 0.003
          if (line.opacity <= 0 || line.y < stageY + 20) return false
          ctx.fillStyle = isProRef.current
            ? `rgba(255, 0, 0, ${line.opacity * 0.5})`
            : `rgba(34, 211, 238, ${line.opacity * 0.5})`
          ctx.fillText(line.text, 8, line.y)
          return true
        })

        // Top status bar
        ctx.fillStyle = isProRef.current ? 'rgba(255, 0, 0, 0.7)' : 'rgba(34, 211, 238, 0.6)'
        ctx.font = 'bold 9px monospace'
        const dots = '.'.repeat(Math.floor(t / 500) % 4)
        ctx.fillText(`⚡ GENERATING${dots}`, 8, 14)

        // Beat pulse ring
        const beat = Math.sin(t * 0.008) * 0.5 + 0.5
        ctx.strokeStyle = isProRef.current
          ? `rgba(255, 0, 0, ${beat * 0.2})`
          : `rgba(34, 211, 238, ${beat * 0.15})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(w / 2, stageY - 15, 50 + beat * 10, 0, Math.PI * 2)
        ctx.stroke()

      } else {
        // ═══════════════════════════════════════
        //  MATRIX RAIN MODE (idle / playing)
        // ═══════════════════════════════════════
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)'
        ctx.fillRect(0, 0, w, h)

        // Reactive hue: pro mode uses pure red (0), otherwise cyan (186) or cycling
        const playing = isPlayRef.current
        const pro = isProRef.current
        const hue = pro ? 0 : (playing ? (t * 0.04) % 360 : 186) // 0 = pure red, 186 ≈ cyan

        ctx.font = `${fontSize}px monospace`
        columns = Math.floor(w / fontSize)
        while (drops.length < columns) drops.push(Math.random() * -100)

        for (let i = 0; i < columns; i++) {
          const char = chars[Math.floor(Math.random() * chars.length)]
          const x = i * fontSize
          const y = drops[i] * fontSize

          const brightness = Math.random()
          if (pro) {
            // Pure red matrix rain — crisp RGB feel
            if (brightness > 0.95) {
              ctx.fillStyle = `rgba(255, 0, 0, 0.95)`
            } else if (brightness > 0.8) {
              ctx.fillStyle = `rgba(255, 0, 0, 0.7)`
            } else {
              ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + Math.random() * 0.25})`
            }
          } else {
            if (brightness > 0.95) {
              ctx.fillStyle = `hsl(${hue}, 80%, 65%)`
            } else if (brightness > 0.8) {
              ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.8)`
            } else {
              ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${0.1 + Math.random() * 0.3})`
            }
          }
          ctx.fillText(char, x, y)

          if (y > h && Math.random() > 0.975) {
            drops[i] = 0
          }
          drops[i] += 0.5 + Math.random() * (playing ? 1.0 : 0.5)
        }

        // Idle GPU logs
        const now = Date.now()
        if (now - lastLogTime > 800 + Math.random() * 1200) {
          const text = gpuLogs[Math.floor(Math.random() * gpuLogs.length)]
          logLines.push({
            text: `[${new Date().toLocaleTimeString()}] ${text}`,
            y: h - 20,
            opacity: 1,
            speed: 0.3 + Math.random() * 0.2,
          })
          lastLogTime = now
        }

        ctx.font = '11px monospace'
        logLines = logLines.filter(line => {
          line.y -= line.speed
          line.opacity -= 0.002
          if (line.opacity <= 0 || line.y < 0) return false
          ctx.fillStyle = pro
            ? `rgba(255, 0, 0, ${line.opacity * 0.7})`
            : `hsla(${hue}, 80%, 55%, ${line.opacity * 0.7})`
          ctx.fillText(line.text, 10, line.y)
          return true
        })

        // Waveform at bottom — reactive amplitude when playing
        const waveH = 40
        const waveY = h - waveH - 5
        const waveAmplitudes: number[] = new Array(64).fill(0)
        for (let i = 0; i < waveAmplitudes.length; i++) {
          const base = Math.sin(now * 0.003 + i * 0.3) * (playing ? 0.6 : 0.3)
          waveAmplitudes[i] = base + Math.random() * (playing ? 0.3 : 0.15)
        }
        const barWidth = w / waveAmplitudes.length
        for (let i = 0; i < waveAmplitudes.length; i++) {
          const amp = Math.abs(waveAmplitudes[i])
          const barH = amp * waveH
          const x = i * barWidth
          if (pro) {
            // Pure red waveform bars
            ctx.fillStyle = `rgba(255, 0, 0, ${0.25 + amp * 0.55})`
          } else {
            const barHue = playing ? (hue + i * 3) % 360 : hue
            ctx.fillStyle = `hsla(${barHue}, 80%, 55%, ${0.2 + amp * 0.5})`
          }
          ctx.fillRect(x + 1, waveY + waveH / 2 - barH / 2, barWidth - 2, barH)
        }

        ctx.fillStyle = pro ? 'rgba(255, 0, 0, 0.5)' : `hsla(${hue}, 80%, 55%, 0.4)`
        ctx.font = '9px monospace'
        ctx.fillText(playing ? '♫ WAVEFORM PLAYBACK' : 'WAVEFORM OUTPUT', 10, waveY - 3)
      }

      ctx.restore()
      animFrame = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className={`relative w-full h-full bg-black rounded-xl overflow-hidden border transition-colors duration-700 ${isProMode ? (isPlaying ? 'border-red-500/40' : isGenerating ? 'border-red-500/30' : 'border-red-500/20') : (isPlaying ? 'border-purple-500/30' : isGenerating ? 'border-orange-500/30' : 'border-cyan-500/20')}`}>
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none z-10" style={{
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
      }} />

      {/* Corner decoration */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full animate-pulse ${isProMode ? 'bg-red-500' : (isPlaying ? 'bg-purple-500' : isGenerating ? 'bg-orange-500' : 'bg-cyan-500')}`} />
        <span className={`text-[10px] font-mono ${isProMode ? 'text-red-500/70' : (isPlaying ? 'text-purple-500/60' : isGenerating ? 'text-orange-500/60' : 'text-cyan-500/60')}`}>444RADIO GPU CONSOLE</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  )
}
