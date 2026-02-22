'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Volume2, VolumeX, GripHorizontal, ChevronDown, Plus, Trash2, Copy, Zap } from 'lucide-react'

// ─── Types ───
interface PatternNode {
  id: string
  name: string
  code: string          // the raw code for this $: block
  muted: boolean
  x: number
  y: number
  // Parsed properties
  sound: string         // detected sound (s/note/sound)
  type: 'drums' | 'bass' | 'melody' | 'chords' | 'fx' | 'vocal' | 'pad' | 'other'
  gain: number          // parsed .gain() value
  hasNote: boolean
  hasFilter: boolean
  hasDelay: boolean
  hasReverb: boolean
  hasScope: boolean
}

// Type color map
const TYPE_COLORS: Record<PatternNode['type'], string> = {
  drums: '#f59e0b',   // amber
  bass: '#ef4444',    // red
  melody: '#22d3ee',  // cyan
  chords: '#a78bfa',  // purple
  fx: '#34d399',      // emerald
  vocal: '#f472b6',   // pink
  pad: '#818cf8',     // indigo
  other: '#94a3b8',   // gray
}

const TYPE_BG: Record<PatternNode['type'], string> = {
  drums: 'rgba(245,158,11,0.08)',
  bass: 'rgba(239,68,68,0.08)',
  melody: 'rgba(34,211,238,0.08)',
  chords: 'rgba(167,139,250,0.08)',
  fx: 'rgba(52,211,153,0.08)',
  vocal: 'rgba(244,114,182,0.08)',
  pad: 'rgba(129,140,248,0.08)',
  other: 'rgba(148,163,184,0.08)',
}

const TYPE_ICONS: Record<PatternNode['type'], string> = {
  drums: '🥁',
  bass: '🎸',
  melody: '🎹',
  chords: '🎵',
  fx: '✨',
  vocal: '🎤',
  pad: '🌊',
  other: '⚡',
}

// ─── Code Parser ───
function parseCodeToNodes(code: string, existingNodes?: PatternNode[]): PatternNode[] {
  const existingMap = new Map<string, PatternNode>()
  if (existingNodes) {
    existingNodes.forEach(n => existingMap.set(n.id, n))
  }

  const nodes: PatternNode[] = []
  // Split by $: declarations (including leading comments)
  const lines = code.split('\n')
  const blocks: { name: string; code: string; startLine: number }[] = []
  
  let currentBlock: string[] = []
  let currentName = ''
  let blockStartLine = 0
  let preamble: string[] = []  // Lines before first $:
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Check if this is a new $: block
    if (trimmed.startsWith('$:') || trimmed.startsWith('$: ')) {
      // Save previous block
      if (currentBlock.length > 0) {
        blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
      }
      
      // Check preceding comment for name
      const prevLine = i > 0 ? lines[i - 1].trim() : ''
      if (prevLine.startsWith('//')) {
        currentName = prevLine.replace(/^\/\/\s*/, '').replace(/[─—-]+/g, '').trim()
      } else {
        currentName = ''
      }
      
      currentBlock = [line]
      blockStartLine = i
    } else if (currentBlock.length > 0) {
      // Continuation of current block — check if it's a new comment block for the next $:
      if (trimmed.startsWith('//') && i + 1 < lines.length && lines[i + 1].trim().startsWith('$:')) {
        // This is a comment for the NEXT block, save current
        blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
        currentBlock = []
        currentName = ''
      } else if (trimmed === '' && currentBlock.length > 0) {
        // Empty line — might be end of block
        // Look ahead: if next non-empty line starts with // or $:, end this block
        let nextIdx = i + 1
        while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++
        if (nextIdx >= lines.length || lines[nextIdx].trim().startsWith('//') || lines[nextIdx].trim().startsWith('$:')) {
          blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
          currentBlock = []
          currentName = ''
        } else {
          currentBlock.push(line)
        }
      } else {
        currentBlock.push(line)
      }
    } else {
      // Before any block — might be a standalone pattern (no $:)
      if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('setcps') && !trimmed.startsWith('setbpm')) {
        // Standalone pattern line
        const prevLine = i > 0 ? lines[i - 1].trim() : ''
        const name = prevLine.startsWith('//') ? prevLine.replace(/^\/\/\s*/, '').replace(/[─—-]+/g, '').trim() : 'pattern'
        
        // Collect all contiguous non-comment, non-empty lines
        const standalone = [line]
        let j = i + 1
        while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('//') && !lines[j].trim().startsWith('$:')) {
          standalone.push(lines[j])
          j++
        }
        blocks.push({ name, code: standalone.join('\n'), startLine: i })
        i = j - 1  // skip processed lines
      } else {
        preamble.push(line)
      }
    }
  }
  
  // Don't forget last block
  if (currentBlock.length > 0) {
    blocks.push({ name: currentName, code: currentBlock.join('\n'), startLine: blockStartLine })
  }

  // Convert blocks to nodes with grid positions
  const cols = 4
  blocks.forEach((block, idx) => {
    const id = `node_${idx}_${block.startLine}`
    const existing = existingMap.get(id)
    
    const type = detectType(block.code)
    const sound = detectSound(block.code)
    const gain = detectGain(block.code)
    
    nodes.push({
      id,
      name: block.name || sound || `Pattern ${idx + 1}`,
      code: block.code,
      muted: existing?.muted ?? false,
      x: existing?.x ?? (idx % cols) * 260 + 30,
      y: existing?.y ?? Math.floor(idx / cols) * 220 + 30,
      sound,
      type,
      gain,
      hasNote: /\bnote\s*\(/.test(block.code),
      hasFilter: /\.(lpf|hpf|bpf|bandpass|lowpass|highpass)\s*\(/.test(block.code),
      hasDelay: /\.delay\s*\(/.test(block.code),
      hasReverb: /\.(room|reverb|roomsize)\s*\(/.test(block.code),
      hasScope: /\.(scope|fscope|pianoroll|pitchwheel|punchcard)\s*\(/.test(block.code),
    })
  })
  
  return nodes
}

function detectType(code: string): PatternNode['type'] {
  const lower = code.toLowerCase()
  if (/\bs\s*\(\s*["'].*?(bd|cp|sd|hh|oh|ch|rim|tom|clap|clave|ride|crash)/i.test(code)) return 'drums'
  if (/\.bank\s*\(/.test(code) && !/note\s*\(/.test(code)) return 'drums'
  if (/note\s*\(.*?[12]\b/.test(code) && /bass|sub|sine/i.test(code)) return 'bass'
  if (lower.includes('bass') || lower.includes('sub')) return 'bass'
  if (/note\s*\(.*?[45]\b/.test(code)) return 'melody'
  if (/note\s*\(.*?\[.*?,.*?\]/.test(code)) return 'chords'
  if (lower.includes('chord') || lower.includes('pad') || lower.includes('rhodes')) return 'chords'
  if (lower.includes('pad') || lower.includes('ambient') || lower.includes('drone')) return 'pad'
  if (lower.includes('vocal') || lower.includes('voice') || lower.includes('choir') || lower.includes('sing')) return 'vocal'
  if (/\.(delay|room|crush|phaser|flanger|tremolo|wah)\s*\(/.test(code)) return 'fx'
  if (/note\s*\(/.test(code)) return 'melody'
  return 'other'
}

function detectSound(code: string): string {
  // Match s("...") or .s("...") or .sound("...")
  const sMatch = code.match(/\.?s(?:ound)?\s*\(\s*["']([^"']+)["']/)
  if (sMatch) return sMatch[1].split(/[\s*[\]]/)[0]
  // Match bank
  const bankMatch = code.match(/\.bank\s*\(\s*["']([^"']+)["']/)
  if (bankMatch) return bankMatch[1]
  // Match note source
  const noteMatch = code.match(/\.s\s*\(\s*["']([^"']+)["']/)
  if (noteMatch) return noteMatch[1]
  return ''
}

function detectGain(code: string): number {
  const match = code.match(/\.gain\s*\(\s*(?:slider\s*\(\s*)?([0-9.]+)/)
  return match ? parseFloat(match[1]) : 0.5
}

// ─── Rebuild code from nodes ───
function nodesToCode(nodes: PatternNode[], originalCode: string): string {
  // Extract preamble (setcps, initial comments, etc.)
  const lines = originalCode.split('\n')
  const preambleLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('$:') || (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('setcps') && !trimmed.startsWith('setbpm') && trimmed !== '')) {
      break
    }
    preambleLines.push(line)
  }
  
  const parts = [preambleLines.join('\n')]
  for (const node of nodes) {
    const commentLine = node.name ? `// ── ${node.name} ──` : ''
    if (node.muted) {
      // Comment out each line
      const mutedCode = node.code.split('\n').map(l => `// [muted] ${l}`).join('\n')
      parts.push(commentLine ? `${commentLine}\n${mutedCode}` : mutedCode)
    } else {
      // Apply gain changes
      let code = node.code
      const gainMatch = code.match(/(\.gain\s*\(\s*(?:slider\s*\(\s*)?)([0-9.]+)/)
      if (gainMatch) {
        code = code.replace(gainMatch[0], gainMatch[1] + node.gain.toFixed(2))
      }
      parts.push(commentLine ? `${commentLine}\n${code}` : code)
    }
  }
  
  return parts.join('\n\n')
}

// ─── Mini Scope Component ───
function MiniScope({ color, isPlaying, type }: { color: string; isPlaying: boolean; type: PatternNode['type'] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const phaseRef = useRef(Math.random() * Math.PI * 2)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const W = canvas.width
    const H = canvas.height
    
    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      
      if (!isPlaying) {
        // Static waveform when not playing
        ctx.beginPath()
        ctx.strokeStyle = `${color}30`
        ctx.lineWidth = 1.5
        for (let x = 0; x < W; x++) {
          const t = x / W
          const y = H / 2 + Math.sin(t * Math.PI * 4 + phaseRef.current) * H * 0.25
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        return
      }
      
      phaseRef.current += 0.08
      
      // Different waveform shapes per type
      ctx.beginPath()
      ctx.strokeStyle = `${color}90`
      ctx.lineWidth = 1.5
      ctx.shadowColor = color
      ctx.shadowBlur = 4
      
      for (let x = 0; x < W; x++) {
        const t = x / W
        let y = H / 2
        
        switch (type) {
          case 'drums':
            // Spiky impulses
            y = H / 2 + (Math.random() - 0.5) * H * 0.6 * Math.pow(Math.sin(t * Math.PI * 8 + phaseRef.current), 8)
            break
          case 'bass':
            // Low slow wave
            y = H / 2 + Math.sin(t * Math.PI * 2 + phaseRef.current * 0.5) * H * 0.35
            break
          case 'melody':
            // Clean sine-like
            y = H / 2 + Math.sin(t * Math.PI * 6 + phaseRef.current) * H * 0.3
            break
          case 'chords':
            // Layered waves
            y = H / 2 + (Math.sin(t * Math.PI * 3 + phaseRef.current) + Math.sin(t * Math.PI * 5 + phaseRef.current * 1.3) * 0.5) * H * 0.2
            break
          case 'pad':
            // Smooth wide wave
            y = H / 2 + Math.sin(t * Math.PI * 1.5 + phaseRef.current * 0.3) * H * 0.35 + Math.sin(t * Math.PI * 4 + phaseRef.current * 0.7) * H * 0.1
            break
          case 'vocal':
            // Formant-like
            y = H / 2 + Math.sin(t * Math.PI * 5 + phaseRef.current) * H * 0.25 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2 + phaseRef.current * 0.5))
            break
          case 'fx':
            // Noisy
            y = H / 2 + (Math.random() - 0.5) * H * 0.3 + Math.sin(t * Math.PI * 10 + phaseRef.current * 2) * H * 0.15
            break
          default:
            y = H / 2 + Math.sin(t * Math.PI * 4 + phaseRef.current) * H * 0.25
        }
        
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      
      rafRef.current = requestAnimationFrame(draw)
    }
    
    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [color, isPlaying, type])
  
  return <canvas ref={canvasRef} width={200} height={40} className="w-full h-full" />
}


// ─── Effect Badge ───
function EffectBadge({ label, active, color }: { label: string; active: boolean; color: string }) {
  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wider uppercase transition-all ${
      active ? 'opacity-90' : 'opacity-20'
    }`} style={{
      background: active ? `${color}20` : 'transparent',
      color: active ? color : 'rgba(255,255,255,0.3)',
      border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
    }}>
      {label}
    </span>
  )
}


// ─── Main Node Editor ───
interface NodeEditorProps {
  code: string
  isPlaying: boolean
  onCodeChange: (newCode: string) => void
  onUpdate: () => void
}

export default function NodeEditor({ code, isPlaying, onCodeChange, onUpdate }: NodeEditorProps) {
  const [nodes, setNodes] = useState<PatternNode[]>([])
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const lastCodeRef = useRef(code)
  
  // Parse code into nodes when code changes externally
  useEffect(() => {
    if (code !== lastCodeRef.current) {
      lastCodeRef.current = code
      setNodes(prev => parseCodeToNodes(code, prev))
    }
  }, [code])
  
  // Initial parse
  useEffect(() => {
    setNodes(parseCodeToNodes(code))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Node mutations ───
  const toggleMute = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, muted: !n.muted } : n)
      const newCode = nodesToCode(updated, code)
      lastCodeRef.current = newCode
      onCodeChange(newCode)
      // Auto-update if playing
      setTimeout(onUpdate, 50)
      return updated
    })
  }, [code, onCodeChange, onUpdate])

  const updateGain = useCallback((id: string, gain: number) => {
    setNodes(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, gain } : n)
      return updated
    })
  }, [])

  const commitGain = useCallback((id: string) => {
    setNodes(prev => {
      const newCode = nodesToCode(prev, code)
      lastCodeRef.current = newCode
      onCodeChange(newCode)
      setTimeout(onUpdate, 50)
      return prev
    })
  }, [code, onCodeChange, onUpdate])

  const deleteNode = useCallback((id: string) => {
    setNodes(prev => {
      const updated = prev.filter(n => n.id !== id)
      const newCode = nodesToCode(updated, code)
      lastCodeRef.current = newCode
      onCodeChange(newCode)
      setTimeout(onUpdate, 50)
      return updated
    })
  }, [code, onCodeChange, onUpdate])

  const duplicateNode = useCallback((id: string) => {
    setNodes(prev => {
      const source = prev.find(n => n.id === id)
      if (!source) return prev
      const newNode: PatternNode = {
        ...source,
        id: `node_dup_${Date.now()}`,
        name: `${source.name} copy`,
        x: source.x + 30,
        y: source.y + 30,
        muted: false,
      }
      const updated = [...prev, newNode]
      const newCode = nodesToCode(updated, code)
      lastCodeRef.current = newCode
      onCodeChange(newCode)
      setTimeout(onUpdate, 50)
      return updated
    })
  }, [code, onCodeChange, onUpdate])

  // ─── Quick add templates ───
  const addNode = useCallback((template: string) => {
    const templates: Record<string, string> = {
      drums: `$: s("bd [~ bd] ~ ~, ~ cp ~ ~, hh*8")
  .bank("RolandTR808").gain(0.7)`,
      bass: `$: note("<c2 f2 g2 c2>")
  .s("sawtooth").lpf(400).gain(0.4)`,
      melody: `$: note("c4 e4 g4 b4 a4 g4 e4 c4")
  .s("triangle").lpf(2000).gain(0.35)
  .room(0.3)`,
      chords: `$: note("<[c3,e3,g3] [a2,c3,e3] [f2,a2,c3] [g2,b2,d3]>")
  .s("sawtooth").lpf(1200).gain(0.25)
  .room(0.5).slow(2)`,
      pad: `$: note("<[c3,g3,e4] [a2,e3,c4]>")
  .s("sawtooth").lpf(800).gain(0.15)
  .room(0.9).slow(4)`,
      fx: `$: s("hh*16").gain(0.1)
  .delay(0.25).delayfeedback(0.5)
  .room(0.6).lpf(2000)`,
    }
    const t = templates[template] || templates.drums
    const newCode = code.trim() + '\n\n// ── new ' + template + ' ──\n' + t
    lastCodeRef.current = newCode
    onCodeChange(newCode)
    setNodes(parseCodeToNodes(newCode))
    setTimeout(onUpdate, 100)
    setShowAddMenu(false)
  }, [code, onCodeChange, onUpdate])

  // ─── Drag handling ───
  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    setDragging({
      id: nodeId,
      offsetX: (e.clientX - rect.left) / zoom - pan.x - node.x,
      offsetY: (e.clientY - rect.top) / zoom - pan.y - node.y,
    })
    setSelectedNode(nodeId)
  }, [nodes, zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const newX = (e.clientX - rect.left) / zoom - pan.x - dragging.offsetX
      const newY = (e.clientY - rect.top) / zoom - pan.y - dragging.offsetY
      // Snap to grid (20px)
      const snapX = Math.round(newX / 20) * 20
      const snapY = Math.round(newY / 20) * 20
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: snapX, y: snapY } : n))
    } else if (isPanning) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setPan({ x: panStart.current.panX + dx / zoom, y: panStart.current.panY + dy / zoom })
    }
  }, [dragging, isPanning, zoom, pan])

  const handleMouseUp = useCallback(() => {
    setDragging(null)
    setIsPanning(false)
  }, [])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on empty space (not on nodes)
    if (e.target === containerRef.current || (e.target as HTMLElement).classList.contains('node-grid-bg')) {
      setIsPanning(true)
      panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
      setSelectedNode(null)
    }
  }, [pan])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY * -0.001
    setZoom(z => Math.max(0.3, Math.min(2, z + delta)))
  }, [])

  // Compute connection lines between related nodes
  const connections = useMemo(() => {
    const lines: { from: PatternNode; to: PatternNode; color: string }[] = []
    // Connect drums → bass → chords → melody (signal flow idea)
    const drumNodes = nodes.filter(n => n.type === 'drums' && !n.muted)
    const bassNodes = nodes.filter(n => n.type === 'bass' && !n.muted)
    const chordNodes = nodes.filter(n => n.type === 'chords' && !n.muted)
    const melodyNodes = nodes.filter(n => n.type === 'melody' && !n.muted)
    const fxNodes = nodes.filter(n => n.type === 'fx' && !n.muted)

    // Connect first of each type in a chain
    if (drumNodes[0] && bassNodes[0]) {
      lines.push({ from: drumNodes[0], to: bassNodes[0], color: TYPE_COLORS.drums })
    }
    if (bassNodes[0] && chordNodes[0]) {
      lines.push({ from: bassNodes[0], to: chordNodes[0], color: TYPE_COLORS.bass })
    }
    if (chordNodes[0] && melodyNodes[0]) {
      lines.push({ from: chordNodes[0], to: melodyNodes[0], color: TYPE_COLORS.chords })
    }
    // FX connects from everything
    if (fxNodes[0]) {
      const source = melodyNodes[0] || chordNodes[0] || bassNodes[0] || drumNodes[0]
      if (source) lines.push({ from: source, to: fxNodes[0], color: TYPE_COLORS.fx })
    }
    return lines
  }, [nodes])

  return (
    <div className="flex flex-col h-full bg-black/60 select-none">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.15em] text-white/30 uppercase">Nodes</span>
          <span className="text-[9px] text-white/15">{nodes.length} pattern{nodes.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Quick add */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(p => !p)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
            >
              <Plus size={10} /> Add
            </button>
            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900/95 border border-white/10 rounded-lg p-1 z-50 min-w-[140px] backdrop-blur-xl shadow-2xl">
                {(['drums', 'bass', 'melody', 'chords', 'pad', 'fx'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => addNode(t)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-[11px] text-white/70 hover:bg-white/10 transition cursor-pointer"
                  >
                    <span>{TYPE_ICONS[t]}</span>
                    <span className="capitalize">{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Zoom controls */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="px-1.5 py-0.5 text-[10px] text-white/30 hover:text-white/60 border border-white/[0.06] rounded transition cursor-pointer">−</button>
            <span className="text-[9px] text-white/20 w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="px-1.5 py-0.5 text-[10px] text-white/30 hover:text-white/60 border border-white/[0.06] rounded transition cursor-pointer">+</button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className="px-1.5 py-0.5 text-[9px] text-white/20 hover:text-white/50 border border-white/[0.06] rounded transition cursor-pointer ml-0.5">fit</button>
          </div>
        </div>
      </div>

      {/* Canvas / Grid */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Grid background */}
        <div className="node-grid-bg absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x * zoom}px ${pan.y * zoom}px`,
        }} />

        {/* Connection lines (SVG overlay) */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          {connections.map((conn, i) => {
            const NODE_W = 240
            const NODE_H = 180
            const x1 = (conn.from.x + NODE_W / 2 + pan.x) * zoom
            const y1 = (conn.from.y + NODE_H + pan.y) * zoom
            const x2 = (conn.to.x + NODE_W / 2 + pan.x) * zoom
            const y2 = (conn.to.y + pan.y) * zoom
            const midY = (y1 + y2) / 2
            return (
              <path
                key={i}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                fill="none"
                stroke={conn.color}
                strokeWidth={1.5}
                strokeOpacity={0.2}
                strokeDasharray="4 4"
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => {
          const color = TYPE_COLORS[node.type]
          const isSelected = selectedNode === node.id
          
          return (
            <div
              key={node.id}
              className="absolute select-none"
              style={{
                left: `${(node.x + pan.x) * zoom}px`,
                top: `${(node.y + pan.y) * zoom}px`,
                width: `${240 * zoom}px`,
                transform: `scale(${zoom > 1 ? 1 : 1})`,
                transformOrigin: 'top left',
                zIndex: isSelected ? 20 : dragging?.id === node.id ? 30 : 10,
              }}
            >
              <div
                className={`rounded-xl overflow-hidden transition-all duration-150 ${
                  node.muted ? 'opacity-35' : ''
                } ${isSelected ? 'ring-1' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${TYPE_BG[node.type]}, rgba(0,0,0,0.5))`,
                  border: `1px solid ${isSelected ? color : 'rgba(255,255,255,0.06)'}`,
                  boxShadow: isSelected ? `0 0 20px ${color}20, 0 4px 20px rgba(0,0,0,0.4)` : '0 2px 12px rgba(0,0,0,0.3)',
                  outlineColor: isSelected ? color : undefined,
                  backdropFilter: 'blur(12px)',
                  fontSize: `${Math.max(10, 12 * zoom)}px`,
                }}
              >
                {/* Header — draggable */}
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                >
                  <GripHorizontal size={12} className="text-white/15 shrink-0" style={{ cursor: 'grab' }} />
                  <span className="text-sm shrink-0">{TYPE_ICONS[node.type]}</span>
                  <span className="text-[11px] font-bold truncate flex-1" style={{ color }}>{node.name || 'Untitled'}</span>
                  
                  {/* Mute toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleMute(node.id) }}
                    className="p-1 rounded hover:bg-white/10 transition cursor-pointer"
                    title={node.muted ? 'Unmute' : 'Mute'}
                  >
                    {node.muted ? <VolumeX size={12} className="text-red-400/60" /> : <Volume2 size={12} style={{ color: `${color}80` }} />}
                  </button>
                </div>

                {/* Scope visualization */}
                <div className="px-3 h-[40px] relative">
                  <MiniScope color={color} isPlaying={isPlaying && !node.muted} type={node.type} />
                </div>

                {/* Controls */}
                <div className="px-3 py-2 space-y-2">
                  {/* Gain slider */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/25 w-6 shrink-0">VOL</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={node.gain}
                      onChange={(e) => { e.stopPropagation(); updateGain(node.id, parseFloat(e.target.value)) }}
                      onMouseUp={() => commitGain(node.id)}
                      className="flex-1 h-1 accent-current cursor-pointer"
                      style={{ accentColor: color }}
                      onClick={e => e.stopPropagation()}
                    />
                    <span className="text-[9px] text-white/25 w-6 text-right">{Math.round(node.gain * 100)}</span>
                  </div>

                  {/* Effect badges */}
                  <div className="flex flex-wrap gap-1">
                    <EffectBadge label="NOTE" active={node.hasNote} color={color} />
                    <EffectBadge label="LPF" active={node.hasFilter} color={color} />
                    <EffectBadge label="DLY" active={node.hasDelay} color={color} />
                    <EffectBadge label="REV" active={node.hasReverb} color={color} />
                    <EffectBadge label="VIZ" active={node.hasScope} color={color} />
                  </div>

                  {/* Sound info */}
                  {node.sound && (
                    <div className="flex items-center gap-1.5">
                      <Zap size={8} style={{ color: `${color}60` }} />
                      <span className="text-[9px] text-white/30 truncate">{node.sound}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isSelected && (
                  <div className="flex items-center justify-end gap-1 px-3 py-1.5 border-t border-white/[0.04]">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateNode(node.id) }}
                      className="p-1 rounded text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNode(node.id) }}
                      className="p-1 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-4 opacity-20">🎛️</div>
              <p className="text-[12px] text-white/20 mb-2">No patterns yet</p>
              <p className="text-[10px] text-white/10">Write code in the editor or click Add above</p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 bg-white/[0.02] border-t border-white/[0.04] text-[9px] text-white/20 shrink-0">
        <span>drag nodes · scroll to zoom · click empty space to pan</span>
        <span>{nodes.filter(n => !n.muted).length}/{nodes.length} active</span>
      </div>
    </div>
  )
}
