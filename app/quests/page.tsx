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

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    case 'daily': return { bg: 'from-cyan-500/15 to-teal-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', glow: 'shadow-cyan-500/15' }
    case 'weekly': return { bg: 'from-teal-500/15 to-cyan-600/10', border: 'border-teal-400/30', text: 'text-teal-300', glow: 'shadow-teal-400/15' }
    case 'monthly': return { bg: 'from-cyan-600/15 to-teal-700/10', border: 'border-cyan-400/30', text: 'text-cyan-300', glow: 'shadow-cyan-400/15' }
    case 'yearly': return { bg: 'from-teal-600/15 to-cyan-700/10', border: 'border-teal-400/30', text: 'text-teal-300', glow: 'shadow-teal-400/15' }
    default: return { bg: 'from-gray-600/15 to-gray-700/10', border: 'border-gray-500/30', text: 'text-gray-400', glow: 'shadow-gray-500/15' }
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

// â”€â”€â”€ Quest Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    <div className={`group relative bg-gradient-to-br ${colors.bg} backdrop-blur-2xl border ${colors.border} rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${colors.glow} shadow-xl shadow-black/10`}>
      {/* Scan-line effect */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent animate-pulse" />
      </div>

      {/* Top row: type badge + reward */}
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors.text} bg-black/40 border ${colors.border}`}>
          {getQuestTypeIcon(quest.quest_type)}
          {quest.quest_type}
        </span>
        <div className="flex items-center gap-1.5">
          <Zap size={14} className="text-cyan-400" />
          <span className="text-cyan-300 font-bold text-sm">{quest.credits_reward}</span>
          <span className="text-cyan-300/50 text-xs">credits</span>
        </div>
      </div>

      {/* Title + description */}
      <h3 className="text-white font-bold text-lg mb-1 tracking-tight">{quest.title}</h3>
      <p className="text-gray-400 text-sm mb-4 line-clamp-2">{quest.description}</p>

      {/* Progress bar */}
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 text-xs">Progress</span>
            <span className={`text-xs font-mono font-bold ${isCompleted || isClaimed ? 'text-cyan-300' : colors.text}`}>
              {progress.progress}/{progress.target}
            </span>
          </div>
          <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                isClaimed ? 'bg-gradient-to-r from-cyan-400 to-teal-300' :
                isCompleted ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 animate-pulse' :
                'bg-gradient-to-r from-cyan-600 to-teal-400'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex items-center gap-3">
        {isClaimed ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 rounded-xl text-cyan-300 text-sm font-medium">
            <CheckCircle2 size={16} />
            Claimed
          </div>
        ) : isCompleted ? (
          <button
            onClick={() => onClaim(quest.id)}
            disabled={claiming === quest.id}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm shadow-lg shadow-cyan-500/30"
          >
            {claiming === quest.id ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Gift size={16} />
            )}
            Claim Reward
          </button>
        ) : isActive ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/25 rounded-xl text-cyan-300 text-sm font-medium">
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

// â”€â”€â”€ Stats Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatsPanel({ stats }: { stats: QuestStats | null }) {
  if (!stats) return null
  const items = [
    { label: 'Participants', value: stats.totalParticipants, icon: Users, color: 'text-cyan-400' },
    { label: 'Active Quests', value: stats.activeQuests, icon: Target, color: 'text-cyan-300' },
    { label: 'Completions', value: stats.totalCompletions, icon: Trophy, color: 'text-sky-400' },
    { label: 'Rate', value: `${stats.completionRate}%`, icon: TrendingUp, color: 'text-cyan-300' },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(item => (
        <div key={item.label} className="bg-black/50 backdrop-blur-2xl border border-white/[0.06] rounded-xl p-3 flex flex-col items-center gap-1 shadow-lg shadow-black/10">
          <item.icon size={18} className={item.color} />
          <span className="text-gray-100 font-bold text-lg">{item.value}</span>
          <span className="text-gray-500 text-[10px] uppercase tracking-wider">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function QuestsPage() {
  const { user, isSignedIn } = useUser()
  const router = useRouter()
  const { totalCredits: credits, refreshCredits } = useCredits()

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
  const [claimToast, setClaimToast] = useState<{ credits: number; title: string } | null>(null)

  // â”€â”€ Fetch quests + stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        // Show celebration toast
        const quest = quests.find(q => q.id === questId)
        setClaimToast({ credits: data.creditsAwarded || 0, title: quest?.title || 'Quest' })
        setTimeout(() => setClaimToast(null), 5000)
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

  // â”€â”€ Filtered quests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredQuests = quests.filter(q => filter === 'all' || q.quest_type === filter)
  const passActive = pass && new Date(pass.expires_at) > new Date()
  const passDaysLeft = pass ? Math.max(0, Math.ceil((new Date(pass.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0

  // â”€â”€ Canvas background ref â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = canvas.width = window.innerWidth
    let h = canvas.height = window.innerHeight

    // â”€â”€ Code rain columns (multi-color like reference images) â”€â”€
    const fontSize = 13
    const cols = Math.ceil(w / fontSize)
    const drops: number[] = Array.from({ length: cols }, () => Math.random() * -50)
    const speeds: number[] = Array.from({ length: cols }, () => 0.3 + Math.random() * 0.7)
    const colors = ['#06b6d4', '#60a5fa', '#2563eb', '#1d4ed8', '#93c5fd', '#6b7280', '#475569', '#38bdf8']
    const colColors: string[] = Array.from({ length: cols }, () => colors[Math.floor(Math.random() * colors.length)])

    // Characters: code-like symbols + binary + "444"
    const charSets = [
      '01{}[]()<>+=;:./\\|!@#$%^&*~',
      'function(){return}const let var=>async await',
      '444RADIO0xFFABCDEF',
      'âš¡â–¶â– â–¡â—†â—‡â—â—‹â–ºâ—„â–²â–¼',
    ]
    const allChars = charSets.join('')

    // â”€â”€ Floating circuit nodes â”€â”€
    interface CircuitNode { x: number; y: number; vx: number; vy: number; size: number; color: string; pulse: number }
    const nodes: CircuitNode[] = Array.from({ length: 40 }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      size: 1 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      pulse: Math.random() * Math.PI * 2,
    }))

    // â”€â”€ Glowing "444" in center â”€â”€
    let frame = 0

    function draw444(t: number) {
      ctx!.save()
      const cx = w / 2, cy = h / 2 - 40
      const size = Math.min(w * 0.35, 220)
      const alpha = 0.04 + Math.sin(t * 0.002) * 0.015

      // Outer glow
      ctx!.shadowBlur = 80
      ctx!.shadowColor = 'rgba(59, 130, 246, 0.3)'
      ctx!.font = `${size}px "JetBrains Mono", "Fira Code", monospace`
      ctx!.textAlign = 'center'
      ctx!.textBaseline = 'middle'
      ctx!.fillStyle = `rgba(59, 130, 246, ${alpha})`
      ctx!.fillText('444', cx, cy)

      // Inner bright flash
      ctx!.shadowBlur = 40
      ctx!.shadowColor = 'rgba(99, 102, 241, 0.2)'
      ctx!.fillStyle = `rgba(99, 102, 241, ${alpha * 0.6})`
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
            ctx!.strokeStyle = `rgba(59, 130, 246, ${alpha})`
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
      scanGrad.addColorStop(0, 'rgba(59, 130, 246, 0)')
      scanGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.03)')
      scanGrad.addColorStop(1, 'rgba(59, 130, 246, 0)')
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

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        {/* Top vignette â€” dark */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
        {/* Center spotlight */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,_rgba(6,182,212,0.04)_0%,_transparent_70%)]" />
        {/* Cyan accent glow bottom-right */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_90%,_rgba(6,182,212,0.03)_0%,_transparent_50%)]" />
        {/* Subtle accent top-left */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,_rgba(20,184,166,0.03)_0%,_transparent_50%)]" />
      </div>

      {/* CRT / console overlay effect */}
      <div className="fixed inset-0 pointer-events-none z-[2] mix-blend-overlay opacity-[0.03]" style={{
        backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.15) 2px, rgba(255,255,255,0.15) 4px)`,
      }} />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 md:pl-24">

        {/* Quest Reward Celebration Toast */}
        {claimToast && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-[slideDown_0.4s_cubic-bezier(0.22,1,0.36,1)]">
            <div className="flex items-center gap-3 pl-4 pr-5 py-3.5 rounded-2xl border border-cyan-500/40 shadow-2xl shadow-cyan-500/20"
              style={{ background: 'linear-gradient(135deg, rgba(8,51,68,0.95), rgba(8,20,30,0.97))' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #14b8a6)', boxShadow: '0 0 20px rgba(6,182,212,0.4)' }}>
                <Gift size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Quest Reward Claimed!</p>
                <p className="text-xs text-cyan-300/80">{claimToast.title} â€” <span className="text-cyan-400 font-bold">+{claimToast.credits} credits</span></p>
              </div>
              <button onClick={() => setClaimToast(null)} className="ml-2 text-cyan-400/40 hover:text-white transition-colors">âœ•</button>
            </div>
          </div>
        )}
        
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
                <div className="p-2.5 bg-gradient-to-br from-cyan-500/15 to-teal-600/15 border border-cyan-500/25 rounded-xl">
                  <Swords size={24} className="text-cyan-400" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent">
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
            <div className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-xl border border-cyan-500/15 rounded-xl">
              <Zap size={16} className="text-cyan-400" />
              <span className="text-white font-bold">{credits ?? '...'}</span>
              <span className="text-gray-500 text-xs">credits</span>
            </div>
          </div>
        </div>

        {/* â”€â”€â”€â”€ Quest Pass Status Bar â”€â”€â”€â”€ */}
        <div className={`mb-8 p-4 md:p-5 rounded-2xl border backdrop-blur-xl transition-all ${
          passActive
            ? 'bg-gradient-to-r from-cyan-500/10 to-teal-600/10 border-cyan-500/25 shadow-lg shadow-cyan-500/5'
            : 'bg-gradient-to-r from-gray-800/60 to-gray-900/60 border-gray-600/30'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {passActive ? (
                <div className="p-2 bg-cyan-500/15 rounded-lg border border-cyan-500/20">
                  <Shield size={20} className="text-cyan-400" />
                </div>
              ) : (
                <div className="p-2 bg-gray-700/30 rounded-lg border border-gray-600/20">
                  <Lock size={20} className="text-gray-400" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${passActive ? 'text-cyan-400' : 'text-gray-400'}`}>
                    Quest Pass: {passActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                  {passActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/20">
                      {passDaysLeft}d remaining
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs mt-0.5">
                  {passActive
                    ? `Expires ${new Date(pass!.expires_at).toLocaleDateString()}`
                    : 'Activate your Quest Pass to start earning credits from challenges (30 credits)'
                  }
                </p>
              </div>
            </div>

            {!passActive && (
              <button
                onClick={handlePurchasePass}
                disabled={purchasing}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-cyan-600/30 text-sm border border-cyan-400/20"
              >
                {purchasing ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Unlock size={16} />
                )}
                Activate Quest Pass â€” 30 Credits
              </button>
            )}
          </div>
        </div>

        {/* Error toast */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-xl backdrop-blur-xl">
            <AlertTriangle size={18} className="text-red-400/80 flex-shrink-0" />
            <p className="text-red-300/80 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-gray-500 hover:text-gray-300">âœ•</button>
          </div>
        )}

        {/* â”€â”€â”€â”€ Main Grid â”€â”€â”€â”€ */}
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
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                      : 'bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:bg-white/[0.06] hover:text-gray-300'
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
                <p className="text-gray-600 text-sm mt-1">Check back soon â€” new missions deploy regularly.</p>
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
            <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-cyan-400" />
                <h2 className="text-gray-300 font-bold text-sm uppercase tracking-wider">Analytics</h2>
              </div>
              <StatsPanel stats={stats} />
            </div>

            {/* Reward tiers info */}
            <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 shadow-xl shadow-black/20">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-cyan-400" />
                <h2 className="text-gray-300 font-bold text-sm uppercase tracking-wider">Reward Tiers</h2>
              </div>
              <div className="space-y-3">
                {[
                  { type: 'Daily', reward: '50', color: 'text-cyan-400', border: 'border-cyan-500/15' },
                  { type: 'Weekly', reward: '20', color: 'text-cyan-300', border: 'border-cyan-400/15' },
                  { type: 'Monthly', reward: '100', color: 'text-indigo-300', border: 'border-indigo-500/15' },
                  { type: 'Yearly', reward: '250', color: 'text-sky-300', border: 'border-sky-500/15' },
                ].map(tier => (
                  <div key={tier.type} className={`flex items-center justify-between p-2.5 rounded-lg border ${tier.border} bg-white/[0.02]`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${tier.color}`}>{tier.type}</span>
                    <div className="flex items-center gap-1">
                      <Zap size={12} className="text-cyan-400" />
                      <span className="text-cyan-300 font-bold text-xs">{tier.reward}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="bg-black/50 backdrop-blur-2xl border border-white/[0.06] rounded-2xl p-5 shadow-xl shadow-black/20">
              <h2 className="text-gray-300 font-bold text-sm uppercase tracking-wider mb-3">How It Works</h2>
              <ol className="space-y-2.5 text-gray-500 text-xs">
                {[
                  'Pay 30 credits to activate your Quest Pass', 
                  'Browse and start available quests',
                  'Complete challenges by using the platform',
                  'Claim your credit rewards',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-[10px] font-bold">
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
