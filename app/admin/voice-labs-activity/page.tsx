'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  Activity, Users, Zap, Clock, Type, Mic, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, BarChart3, MessageSquare,
  ArrowLeft
} from 'lucide-react'

interface UserStats {
  user_id: string
  display_name: string
  total_generations: number
  successful_generations: number
  failed_generations: number
  total_tokens_consumed: number
  total_credits_spent: number
  total_input_time_ms: number
  total_keystroke_count: number
  avg_text_length: number
  max_text_length: number
  voices_used: string[]
  first_activity: string
  last_activity: string
  session_count: number
}

interface ActivityEvent {
  id: string
  user_id: string
  display_name: string
  event_type: string
  session_id: string | null
  text_length: number | null
  text_snapshot: string | null
  input_duration_ms: number | null
  keystroke_count: number | null
  paste_count: number | null
  delete_count: number | null
  revision_count: number | null
  voice_id: string | null
  tokens_consumed: number | null
  credits_spent: number | null
  generation_duration_ms: number | null
  audio_url: string | null
  settings: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, unknown>
  created_at: string
}

const ADMIN_USER_ID = 'user_34StnaXDJ3yZTYmz1Wmv3sYcqcB'

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function EventBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    session_open: 'bg-green-500/20 text-green-400',
    session_close: 'bg-gray-500/20 text-gray-400',
    input_start: 'bg-blue-500/20 text-blue-400',
    input_end: 'bg-blue-500/20 text-blue-300',
    generation_start: 'bg-yellow-500/20 text-yellow-400',
    generation_complete: 'bg-cyan-500/20 text-cyan-400',
    generation_failed: 'bg-red-500/20 text-red-400',
    voice_change: 'bg-purple-500/20 text-purple-400',
    settings_change: 'bg-orange-500/20 text-orange-400',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${colors[type] || 'bg-white/10 text-gray-400'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export default function AdminVoiceLabsActivityPage() {
  const { user } = useUser()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'stats' | 'feed' | 'generations'>('stats')
  const [days, setDays] = useState(30)
  const [filterUserId, setFilterUserId] = useState('')
  const [stats, setStats] = useState<UserStats[]>([])
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isAdmin = user?.id === ADMIN_USER_ID

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        view,
        days: days.toString(),
        limit: '200',
      })
      if (filterUserId.trim()) params.set('user_id', filterUserId.trim())

      const res = await fetch(`/api/admin/voice-labs-activity?${params}`)
      if (!res.ok) {
        if (res.status === 403) { setError('Unauthorized — Admin only'); return }
        throw new Error(`API returned ${res.status}`)
      }
      const data = await res.json()
      if (view === 'stats') {
        setStats(data.data || [])
      } else {
        setEvents(data.data || [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [view, days, filterUserId])

  useEffect(() => {
    if (user && isAdmin) fetchData()
  }, [user, isAdmin, fetchData])

  if (!user) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>
  if (!isAdmin) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Admin only</div>

  // Aggregate totals for stats view
  const totals = stats.reduce((acc, s) => ({
    generations: acc.generations + s.total_generations,
    successful: acc.successful + s.successful_generations,
    failed: acc.failed + s.failed_generations,
    tokens: acc.tokens + s.total_tokens_consumed,
    credits: acc.credits + s.total_credits_spent,
    inputTime: acc.inputTime + s.total_input_time_ms,
    keystrokes: acc.keystrokes + s.total_keystroke_count,
    sessions: acc.sessions + s.session_count,
  }), { generations: 0, successful: 0, failed: 0, tokens: 0, credits: 0, inputTime: 0, keystrokes: 0, sessions: 0 })

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/10 transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Activity size={24} className="text-cyan-400" />
                Voice Labs Activity
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">Detailed user activity tracking for Voice Labs</p>
            </div>
          </div>
          <button onClick={fetchData} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/15 rounded-lg text-sm transition">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['stats', 'feed', 'generations'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-2 text-sm font-medium transition ${view === v ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400 hover:text-white'}`}>
                {v === 'stats' ? 'User Stats' : v === 'feed' ? 'Live Feed' : 'Generations'}
              </button>
            ))}
          </div>
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300">
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <input
            value={filterUserId} onChange={e => setFilterUserId(e.target.value)}
            placeholder="Filter by user ID..."
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 w-64 placeholder:text-gray-600"
          />
          {filterUserId && (
            <button onClick={() => setFilterUserId('')} className="text-xs text-gray-500 hover:text-white">Clear</button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 rounded-lg px-4 py-3 mb-6 flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* ═══ Stats View ═══ */}
        {view === 'stats' && (
          <>
            {/* Aggregate Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard icon={<Users size={18} />} label="Active Users" value={stats.length} color="cyan" />
              <StatCard icon={<MessageSquare size={18} />} label="Total Generations" value={totals.generations} sub={`${totals.successful} ok / ${totals.failed} failed`} color="blue" />
              <StatCard icon={<Type size={18} />} label="Tokens Consumed" value={totals.tokens.toLocaleString()} color="purple" />
              <StatCard icon={<Zap size={18} />} label="Credits Spent" value={totals.credits.toLocaleString()} color="yellow" />
              <StatCard icon={<Clock size={18} />} label="Total Input Time" value={formatMs(totals.inputTime)} color="green" />
              <StatCard icon={<BarChart3 size={18} />} label="Total Keystrokes" value={totals.keystrokes.toLocaleString()} color="orange" />
              <StatCard icon={<Mic size={18} />} label="Total Sessions" value={totals.sessions.toLocaleString()} color="pink" />
              <StatCard icon={<Activity size={18} />} label="Avg Gen/User" value={stats.length ? (totals.generations / stats.length).toFixed(1) : '0'} color="indigo" />
            </div>

            {/* Per-user table */}
            {loading ? (
              <div className="text-center py-16 text-gray-500">Loading...</div>
            ) : stats.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No activity in the selected period</div>
            ) : (
              <div className="space-y-2">
                {stats.map(s => (
                  <div key={s.user_id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                    <button onClick={() => setExpandedUser(expandedUser === s.user_id ? null : s.user_id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition text-left">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
                          <Users size={14} className="text-cyan-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{s.display_name}</p>
                          <p className="text-[10px] text-gray-600 font-mono">{s.user_id}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">{s.successful_generations} gen / {s.session_count} sessions</p>
                          <p className="text-[10px] text-gray-600">Last: {formatDate(s.last_activity)}</p>
                        </div>
                        {expandedUser === s.user_id ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                      </div>
                    </button>
                    {expandedUser === s.user_id && (
                      <div className="px-4 pb-4 border-t border-white/[0.06]">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                          <MiniStat label="Generations" value={`${s.successful_generations} / ${s.total_generations}`} />
                          <MiniStat label="Failed" value={s.failed_generations} />
                          <MiniStat label="Tokens Used" value={s.total_tokens_consumed.toLocaleString()} />
                          <MiniStat label="Credits Spent" value={s.total_credits_spent.toLocaleString()} />
                          <MiniStat label="Input Time" value={formatMs(s.total_input_time_ms)} />
                          <MiniStat label="Keystrokes" value={s.total_keystroke_count.toLocaleString()} />
                          <MiniStat label="Avg Text Length" value={Math.round(s.avg_text_length || 0)} />
                          <MiniStat label="Max Text Length" value={s.max_text_length || 0} />
                          <MiniStat label="Sessions" value={s.session_count} />
                          <MiniStat label="Voices Used" value={Array.isArray(s.voices_used) ? s.voices_used.filter(Boolean).length : 0} />
                          <MiniStat label="First Activity" value={formatDate(s.first_activity)} />
                          <MiniStat label="Last Activity" value={formatDate(s.last_activity)} />
                        </div>
                        {Array.isArray(s.voices_used) && s.voices_used.filter(Boolean).length > 0 && (
                          <div className="mt-3">
                            <p className="text-[10px] text-gray-500 mb-1.5">Voices used:</p>
                            <div className="flex flex-wrap gap-1">
                              {s.voices_used.filter(Boolean).map((v, i) => (
                                <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-[9px] rounded-full">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        <button onClick={() => { setFilterUserId(s.user_id); setView('feed') }}
                          className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline">
                          View live feed for this user →
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══ Feed / Generations View ═══ */}
        {(view === 'feed' || view === 'generations') && (
          <div>
            {loading ? (
              <div className="text-center py-16 text-gray-500">Loading...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 text-gray-500">No events in the selected period</div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500 mb-3">{events.length} events</p>
                {events.map(evt => (
                  <div key={evt.id} className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5 flex items-start gap-3">
                    <div className="pt-0.5 flex-shrink-0">
                      <EventBadge type={evt.event_type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white">{evt.display_name}</span>
                        <span className="text-[9px] text-gray-600 font-mono">{evt.user_id.substring(0, 20)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[10px] text-gray-500">
                        {evt.text_length != null && <span>📝 {evt.text_length.toLocaleString()} chars</span>}
                        {evt.tokens_consumed != null && <span>🔤 {evt.tokens_consumed.toLocaleString()} tokens</span>}
                        {evt.credits_spent != null && evt.credits_spent > 0 && <span>⚡ {evt.credits_spent} cr</span>}
                        {evt.input_duration_ms != null && <span>⏱️ {formatMs(evt.input_duration_ms)}</span>}
                        {evt.generation_duration_ms != null && <span>🎙️ {formatMs(evt.generation_duration_ms)}</span>}
                        {evt.keystroke_count != null && <span>⌨️ {evt.keystroke_count} keys</span>}
                        {evt.paste_count != null && evt.paste_count > 0 && <span>📋 {evt.paste_count} pastes</span>}
                        {evt.delete_count != null && evt.delete_count > 0 && <span>🗑️ {evt.delete_count} deletes</span>}
                        {evt.revision_count != null && evt.revision_count > 0 && <span>✏️ {evt.revision_count} revisions</span>}
                        {evt.voice_id && <span>🎤 {evt.voice_id}</span>}
                      </div>
                      {evt.text_snapshot && (
                        <p className="mt-1 text-[10px] text-gray-600 truncate max-w-xl">
                          &quot;{evt.text_snapshot.substring(0, 150)}{evt.text_snapshot.length > 150 ? '...' : ''}&quot;
                        </p>
                      )}
                      {evt.audio_url && (
                        <a href={evt.audio_url} target="_blank" rel="noopener" className="text-[9px] text-cyan-500 hover:underline mt-0.5 inline-block">
                          🔊 Listen
                        </a>
                      )}
                      {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                        <p className="text-[9px] text-gray-700 mt-0.5 font-mono truncate max-w-xl">
                          {JSON.stringify(evt.metadata).substring(0, 120)}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] text-gray-600">{formatDate(evt.created_at)}</p>
                      {evt.ip_address && evt.ip_address !== 'unknown' && (
                        <p className="text-[8px] text-gray-700 font-mono">{evt.ip_address}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string
}) {
  const colorMap: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/20',
    blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/20',
    purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/20',
    yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/20',
    green: 'from-green-500/20 to-green-500/5 border-green-500/20',
    orange: 'from-orange-500/20 to-orange-500/5 border-orange-500/20',
    pink: 'from-pink-500/20 to-pink-500/5 border-pink-500/20',
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20',
  }
  return (
    <div className={`bg-gradient-to-b ${colorMap[color] || colorMap.cyan} border rounded-xl p-3`}>
      <div className="flex items-center gap-2 mb-1.5 text-gray-400">{icon}<span className="text-[10px]">{label}</span></div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[9px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/[0.03] rounded-lg p-2">
      <p className="text-[9px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-xs font-medium text-white">{value}</p>
    </div>
  )
}
