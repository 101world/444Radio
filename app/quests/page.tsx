'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  Zap, Shield, Clock, Target, Trophy, Star,
  ChevronRight, Lock, Unlock, TrendingUp,
  Users, CheckCircle2, AlertTriangle, Sparkles,
  Calendar, Gift, Crown, Swords, ArrowLeft
} from 'lucide-react'
import { useCredits } from '../contexts/CreditsContext'

// ─── Types ────────────────────────────────────────────────────────
interface Quest {
  id: string
  title: string
  description: string
  quest_type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  requirement: { action: string; target: number }
  credits_reward: number
  is_active: boolean
  starts_at?: string
  ends_at?: string
  created_at: string
  userProgress?: {
    id: string
    progress: number
    target: number
    status: 'active' | 'completed' | 'expired' | 'claimed'
    started_at: string
    completed_at?: string
    claimed_at?: string
  } | null
}

interface QuestPass {
  id: string
  purchased_at: string
  expires_at: string
  is_active: boolean
}

interface QuestStats {
  totalParticipants: number
  activeQuests: number
  totalCompletions: number
  totalInProgress: number
  completionRate: number
}

type QuestFilter = 'all' | 'daily' | 'weekly' | 'monthly' | 'yearly'

// ─── Helpers ──────────────────────────────────────────────────────
function getTimeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${hours}h ${mins}m`
}

function getQuestTypeColor(type: string) {
  switch (type) {
    case 'daily': return { bg: 'from-emerald-500/20 to-cyan-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' }
    case 'weekly': return { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' }
    case 'monthly': return { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-purple-500/20' }
    case 'yearly': return { bg: 'from-amber-500/20 to-red-500/20', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-amber-500/20' }
    default: return { bg: 'from-gray-500/20 to-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-400', glow: 'shadow-gray-500/20' }
  }
}

function getQuestTypeIcon(type: string) {
  switch (type) {
    case 'daily': return <Zap size={14} />
    case 'weekly': return <Calendar size={14} />
    case 'monthly': return <Target size={14} />
    case 'yearly': return <Crown size={14} />
    default: return <Star size={14} />
  }
}

// ─── Quest Card ───────────────────────────────────────────────────
function QuestCard({ quest, hasPass, onStart, onClaim, starting, claiming }: {
  quest: Quest
  hasPass: boolean
  onStart: (id: string) => void
  onClaim: (id: string) => void
  starting: string | null
  claiming: string | null
}) {
  const colors = getQuestTypeColor(quest.quest_type)
  const progress = quest.userProgress
  const pct = progress ? Math.min(100, Math.round((progress.progress / progress.target) * 100)) : 0
  const isCompleted = progress?.status === 'completed'
  const isClaimed = progress?.status === 'claimed'
  const isActive = progress?.status === 'active'

  return (
    <div className={`group relative bg-gradient-to-br ${colors.bg} backdrop-blur-xl border ${colors.border} rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${colors.glow}`}>
      {/* Scan-line effect */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent animate-pulse" />
      </div>

      {/* Top row: type badge + reward */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.text} bg-black/30 border ${colors.border}`}>
          {getQuestTypeIcon(quest.quest_type)}
          {quest.quest_type}
        </span>
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-yellow-300 font-bold text-sm">{quest.credits_reward}</span>
          <span className="text-yellow-300/60 text-xs">credits</span>
        </div>
      </div>

      {/* Title + description */}
      <h3 className="text-white font-bold text-lg mb-1 tracking-tight">{quest.title}</h3>
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{quest.description}</p>

      {/* Progress bar */}
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-400 text-xs">Progress</span>
            <span className={`text-xs font-mono font-bold ${isCompleted || isClaimed ? 'text-emerald-400' : colors.text}`}>
              {progress.progress}/{progress.target}
            </span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isClaimed ? 'bg-gradient-to-r from-emerald-500 to-cyan-400' :
                isCompleted ? 'bg-gradient-to-r from-yellow-500 to-amber-400 animate-pulse' :
                'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex items-center gap-3">
        {isClaimed ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm font-medium">
            <CheckCircle2 size={16} />
            Claimed
          </div>
        ) : isCompleted ? (
          <button
            onClick={() => onClaim(quest.id)}
            disabled={claiming === quest.id}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-yellow-500/30"
          >
            {claiming === quest.id ? (
              <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
            ) : (
              <Gift size={16} />
            )}
            Claim Reward
          </button>
        ) : isActive ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 text-sm font-medium">
            <Target size={16} className="animate-pulse" />
            In Progress
          </div>
        ) : !hasPass ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 text-sm italic">
            <Lock size={14} />
            Pass Required
          </div>
        ) : (
          <button
            onClick={() => onStart(quest.id)}
            disabled={starting === quest.id}
            className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${colors.bg} hover:brightness-125 border ${colors.border} ${colors.text} font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm`}
          >
            {starting === quest.id ? (
              <div className={`w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin`} />
            ) : (
              <Swords size={16} />
            )}
            Start Quest
          </button>
        )}

        {/* Time remaining for quest type */}
        {quest.ends_at && (
          <span className="ml-auto text-gray-500 text-xs flex items-center gap-1">
            <Clock size={12} />
            {getTimeRemaining(quest.ends_at)}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Stats Card ───────────────────────────────────────────────────
function StatsPanel({ stats }: { stats: QuestStats | null }) {
  if (!stats) return null
  const items = [
    { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-cyan-400' },
    { label: 'Active Quests', value: stats.activeQuests, icon: Target, color: 'text-purple-400' },
    { label: 'Completions', value: stats.totalCompletions, icon: Trophy, color: 'text-yellow-400' },
    { label: 'Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-emerald-400' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 flex flex-col items-center gap-1">
          <item.icon size={18} className={item.color} />
          <span className="text-white font-bold text-lg">{item.value}</span>
          <span className="text-gray-500 text-[10px] uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function QuestsPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { credits, refreshCredits } = useCredits()

  const [quests, setQuests] = useState<Quest[]>([])
  const [pass, setPass] = useState<QuestPass | null>(null)
  const [stats, setStats] = useState<QuestStats | null>(null)
  const [totalCompleted, setTotalCompleted] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<QuestFilter>('all')
  const [starting, setStarting] = useState<string | null>(null)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch quests + stats ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [questsRes, statsRes] = await Promise.all([
        fetch('/api/quests'),
        fetch('/api/quests/stats'),
      ])
      const questsData = await questsRes.json()
      const statsData = await statsRes.json()

      if (questsData.success) {
        setQuests(questsData.quests || [])
        setPass(questsData.pass || null)
        setTotalCompleted(questsData.totalCompleted || 0)
      }
      if (statsData.success) {
        setStats(statsData.stats || null)
      }
    } catch (err) {
      console.error('Failed to fetch quest data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Actions ──────────────────────────────────────────────────────
  const handlePurchasePass = async () => {
    setPurchasing(true)
    setError(null)
    try {
      const res = await fetch('/api/quests/purchase-pass', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setPass(data.pass)
        refreshCredits()
      } else {
        setError(data.error || 'Failed to purchase pass')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setPurchasing(false)
    }
  }

  const handleStart = async (questId: string) => {
    setStarting(questId)
    setError(null)
    try {
      const res = await fetch('/api/quests/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      })
      const data = await res.json()
      if (data.success) {
        fetchData()
      } else {
        setError(data.error || 'Failed to start quest')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setStarting(null)
    }
  }

  const handleClaim = async (questId: string) => {
    setClaiming(questId)
    setError(null)
    try {
      const res = await fetch('/api/quests/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      })
      const data = await res.json()
      if (data.success) {
        refreshCredits()
        fetchData()
      } else {
        setError(data.error || 'Failed to claim reward')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setClaiming(null)
    }
  }

  // ── Filtered quests ──────────────────────────────────────────────
  const filteredQuests = quests.filter(q => filter === 'all' || q.quest_type === filter)
  const passActive = pass && new Date(pass.expires_at) > new Date()
  const passDaysLeft = pass ? Math.max(0, Math.ceil((new Date(pass.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  // ── Canvas background ref ─────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight

    // ── Code rain columns (multi-color like reference images) ──
    const fontSize = 13
    const cols = Math.ceil(w / fontSize)
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -50)
    const speeds: number[] = Array.from({ length: cols }, () => 0.3 + Math.random() * 0.7)
    const colors = ['#06b6d4', '#22d3ee', '#a855f7', '#f43f5e', '#f97316', '#10b981', '#3b82f6', '#eab308']
    const colColors: string[] = Array.from({ length: cols }, () => colors[Math.floor(Math.random() * colors.length)])

    // Characters: code-like symbols + binary + "444"
    const charSets = [
      '01{}[]()<>+=;:./\\|!@#$%^&*~',
      'function(){return}const let var=>async await',
      '444RADIO0xFFABCDEF',
      '⚡▶■□◆◇●○►◄▲▼',
    ]
    const allChars = charSets.join('')

    // ── Floating circuit nodes ──
    interface CircuitNode { x: number; y: number; vx: number; vy: number; size: number; color: string; pulse: number }
    const nodes: CircuitNode[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      size: 1 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulse: Math.random() * Math.PI * 2,
    }))

    // ── Glowing "444" in center ──
    let frame = 0

    function draw444(t: number) {
      ctx!.save()
      const cx = w / 2, cy = h / 2 - 40
      const size = Math.min(w * 0.35, 220)
      const alpha = 0.04 + Math.sin(t * 0.002) * 0.015

      // Outer glow
      ctx!.shadowBlur = 80
      ctx!.shadowColor = 'rgba(6, 182, 212, 0.3)'
      ctx!.font = `${size}px "JetBrains Mono", "Fira Code", monospace`
      ctx!.textAlign = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillStyle = `rgba(6, 182, 212, ${alpha})`
      ctx!.fillText('444', cx, cy)

      // Inner bright flash
      ctx!.shadowBlur = 40
      ctx!.shadowColor = 'rgba(168, 85, 247, 0.2)'
      ctx!.fillStyle = `rgba(168, 85, 247, ${alpha * 0.6})`
      ctx!.fillText('444', cx + 2, cy + 2)

      ctx!.shadowBlur = 0
      ctx!.restore()
    }

    function drawCircuits(t: number) {
      // Move nodes
      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        n.pulse += 0.02
        if (n.x < 0 || n.x > w) n.vx *= -1
        if (n.y < 0 || n.y > h) n.vy *= -1
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.12
            ctx!.strokeStyle = `rgba(243, 63, 94, ${alpha})`
            ctx!.lineWidth = 0.5
            ctx!.beginPath()
            // Circuit-style: right angle connections
            if (Math.random() > 0.5) {
              ctx!.moveTo(nodes[i].x, nodes[i].y)
              ctx!.lineTo(nodes[j].x, nodes[i].y)
              ctx!.lineTo(nodes[j].x, nodes[j].y)
            } else {
              ctx!.moveTo(nodes[i].x, nodes[i].y)
              ctx!.lineTo(nodes[i].x, nodes[j].y)
              ctx!.lineTo(nodes[j].x, nodes[j].y)
            }
            ctx!.stroke()
          }
        }
      }

      // Draw nodes with pulse
      for (const n of nodes) {
        const pulseSize = n.size + Math.sin(n.pulse) * 1
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, pulseSize, 0, Math.PI * 2)
        ctx!.fillStyle = n.color.replace(')', ', 0.6)').replace('rgb', 'rgba')
        ctx!.fill()

        // Glow ring
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, pulseSize + 3, 0, Math.PI * 2)
        ctx!.strokeStyle = n.color.replace(')', ', 0.15)').replace('rgb', 'rgba')
        ctx!.lineWidth = 1
        ctx!.stroke()
      }
    }

    function drawCodeRain() {
      // Fade
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.06)'
      ctx!.fillRect(0, 0, w, h)

      for (let i = 0; i < cols; i++) {
        const char = allChars[Math.floor(Math.random() * allChars.length)]
        const py = drops[i] * fontSize

        // Leading bright char
        ctx!.fillStyle = '#ffffff'
        ctx!.font = `${fontSize}px "JetBrains Mono", "Fira Code", monospace`
        ctx!.globalAlpha = 0.8
        ctx!.fillText(char, i * fontSize, py)

        // Trail chars in column color
        ctx!.fillStyle = colColors[i]
        ctx!.globalAlpha = 0.35
        ctx!.fillText(char, i * fontSize, py)

        ctx!.globalAlpha = 1

        drops[i] += speeds[i]
        if (py > h && Math.random() > 0.985) {
          drops[i] = 0
          colColors[i] = colors[Math.floor(Math.random() * colors.length)]
        }
      }
    }

    function drawScanLines() {
      // Horizontal scan lines
      for (let y = 0; y < h; y += 3) {
        ctx!.fillStyle = `rgba(255, 255, 255, 0.008)`
        ctx!.fillRect(0, y, w, 1)
      }

      // Moving scan line
      const scanY = (frame * 1.5) % (h + 200) - 100
      const scanGrad = ctx!.createLinearGradient(0, scanY - 40, 0, scanY + 40)
      scanGrad.addColorStop(0, 'rgba(6, 182, 212, 0)')
      scanGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.04)')
      scanGrad.addColorStop(1, 'rgba(6, 182, 212, 0)')
      ctx!.fillStyle = scanGrad
      ctx!.fillRect(0, scanY - 40, w, 80)
    }

    function animate() {
      frame++
      drawCodeRain()
      drawCircuits(frame)
      draw444(frame)
      drawScanLines()
      animId = requestAnimationFrame(animate)
    }

    // Initial black fill
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    animate()

    const onResize = () => {
      w = canvas.width = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Full-screen canvas background: code rain + circuits + 444 */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0"
        style={{ pointerEvents: 'none' }}
      />

      {/* Gradient overlays for depth */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        {/* Top vignette — dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
        {/* Center spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,_rgba(6,182,212,0.06)_0%,_transparent_70%)]" />
        {/* Red accent glow bottom-right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_90%,_rgba(244,63,94,0.04)_0%,_transparent_50%)]" />
        {/* Purple accent top-left */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,_rgba(168,85,247,0.04)_0%,_transparent_50%)]" />
      </div>

      {/* CRT / console overlay effect */}
      <div className="fixed inset-0 pointer-events-none z-[2] mix-blend-overlay opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)`,
      }} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 md:pl-24">
        
        {/* Back + Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-xl">
                  <Swords size={24} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    QUESTS
                  </h1>
                  <p className="text-gray-500 text-xs uppercase tracking-[0.3em] font-mono">Mission Control // AI Ops</p>
                </div>
              </div>
              <p className="text-gray-400 text-sm max-w-md">
                Complete challenges to earn free music generation credits. Daily, weekly, monthly & yearly missions.
              </p>
            </div>

            {/* Credits badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur-xl border border-cyan-500/20 rounded-xl">
              <Zap size={16} className="text-cyan-400" />
              <span className="text-white font-bold">{credits ?? '...'}</span>
              <span className="text-gray-500 text-xs">credits</span>
            </div>
          </div>
        </div>

        {/* ──── Quest Pass Status Bar ──── */}
        <div className={`mb-8 p-4 md:p-5 rounded-2xl border backdrop-blur-xl transition-all ${
          passActive
            ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/30'
            : 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {passActive ? (
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Shield size={20} className="text-emerald-400" />
                </div>
              ) : (
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Lock size={20} className="text-red-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${passActive ? 'text-emerald-400' : 'text-red-400'}`}>
                    Quest Pass: {passActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  {passActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      {passDaysLeft}d remaining
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  {passActive
                    ? `Expires ${new Date(pass!.expires_at).toLocaleDateString()}`
                    : 'Purchase a Quest Pass to start earning credits from challenges'
                  }
                </p>
              </div>
            </div>

            {!passActive && (
              <button
                onClick={handlePurchasePass}
                disabled={purchasing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-500/30 text-sm"
              >
                {purchasing ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Unlock size={16} />
                )}
                Activate — 1 Credit
              </button>
            )}
          </div>
        </div>

        {/* Error toast */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* ──── Main Grid ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Left: Quest Feed (3 cols) */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Filter tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(['all', 'daily', 'weekly', 'monthly', 'yearly'] as QuestFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    filter === f
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                      : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'All Quests' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5 text-gray-600 text-xs">
                <Trophy size={12} />
                <span>{totalCompleted} completed</span>
              </div>
            </div>

            {/* Quest cards */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-44 bg-white/5 border border-white/10 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : filteredQuests.length === 0 ? (
              <div className="text-center py-20">
                <Swords size={48} className="mx-auto text-gray-700 mb-4" />
                <p className="text-gray-500 text-lg">No {filter === 'all' ? '' : filter} quests available</p>
                <p className="text-gray-600 text-sm mt-1">Check back soon — new missions deploy regularly.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredQuests.map(quest => (
                  <QuestCard
                    key={quest.id}
                    quest={quest}
                    hasPass={!!passActive}
                    onStart={handleStart}
                    onClaim={handleClaim}
                    starting={starting}
                    claiming={claiming}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar: Analytics (1 col) */}
          <div className="space-y-6">
            {/* Analytics card */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-cyan-400" />
                <h2 className="text-white font-bold text-sm uppercase tracking-wider">Analytics</h2>
              </div>
              <StatsPanel stats={stats} />
            </div>

            {/* Reward tiers info */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-purple-400" />
                <h2 className="text-white font-bold text-sm uppercase tracking-wider">Reward Tiers</h2>
              </div>
              <div className="space-y-3">
                {[
                  { type: 'Daily', reward: '50', color: 'text-emerald-400', border: 'border-emerald-500/20' },
                  { type: 'Weekly', reward: '20', color: 'text-cyan-400', border: 'border-cyan-500/20' },
                  { type: 'Monthly', reward: '100', color: 'text-purple-400', border: 'border-purple-500/20' },
                  { type: 'Yearly', reward: '250', color: 'text-amber-400', border: 'border-amber-500/20' },
                ].map(tier => (
                  <div key={tier.type} className={`flex items-center justify-between p-2.5 rounded-lg border ${tier.border} bg-white/[0.02]`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${tier.color}`}>{tier.type}</span>
                    <div className="flex items-center gap-1">
                      <Zap size={12} className="text-yellow-400" />
                      <span className="text-yellow-300 font-bold text-xs">{tier.reward}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3">How It Works</h2>
              <ol className="space-y-2.5 text-gray-400 text-xs">
                {[
                  'Purchase a Quest Pass (1 credit)',
                  'Browse and start available quests',
                  'Complete challenges by using the platform',
                  'Claim your credit rewards',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <span className="mt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* CSS animations */}
      <style jsx>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}
