'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, Shield, Target, Zap,
  Users, Trophy, TrendingUp, ArrowLeft, Save, X,
  Calendar, Crown, Star, ToggleLeft, ToggleRight
} from 'lucide-react'

const ADMIN_EMAIL = '444radioog@gmail.com'

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
}

interface AdminStats {
  activePassCount: number
  totalCompletions: number
  totalRewards: number
}

const QUEST_ACTIONS = [
  { value: 'generate_songs', label: 'Generate Songs' },
  { value: 'invite_users', label: 'Invite Users' },
  { value: 'upload_marketplace', label: 'Upload to Marketplace' },
  { value: 'use_mastering', label: 'Use AI Mastering' },
  { value: 'generation_streak', label: 'Generation Streak (days)' },
  { value: 'share_tracks', label: 'Share Tracks' },
  { value: 'login_days', label: 'Login Days' },
  { value: 'use_genres', label: 'Use Different Genres' },
  { value: 'use_new_model', label: 'Use New AI Model' },
  { value: 'create_beat', label: 'Create Beat' },
]

export default function QuestAdminPage() {
  const { user } = useUser()
  const router = useRouter()

  const [quests, setQuests] = useState<Quest[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  // Editor state
  const [editing, setEditing] = useState<Quest | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState({
    title: '',
    description: '',
    quest_type: 'weekly' as string,
    action: 'generate_songs',
    target: 10,
    credits_reward: 20,
    is_active: true,
  })

  // Auth check
  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress === ADMIN_EMAIL) {
      setAuthorized(true)
    }
  }, [user])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/quests/admin')
      const data = await res.json()
      if (data.success) {
        setQuests(data.quests || [])
        setStats(data.stats || null)
      }
    } catch (err) {
      console.error('Admin fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (authorized) fetchData() }, [authorized, fetchData])

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', description: '', quest_type: 'weekly', action: 'generate_songs', target: 10, credits_reward: 20, is_active: true })
    setCreating(true)
  }

  const openEdit = (quest: Quest) => {
    setCreating(false)
    setEditing(quest)
    setForm({
      title: quest.title,
      description: quest.description,
      quest_type: quest.quest_type,
      action: quest.requirement?.action || 'generate_songs',
      target: quest.requirement?.target || 1,
      credits_reward: quest.credits_reward,
      is_active: quest.is_active,
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: any = {
        title: form.title,
        description: form.description,
        quest_type: form.quest_type,
        requirement: { action: form.action, target: form.target },
        credits_reward: form.credits_reward,
        is_active: form.is_active,
      }
      if (editing) body.id = editing.id

      const res = await fetch('/api/quests/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setEditing(null)
        setCreating(false)
        fetchData()
      }
    } catch (err) {
      console.error('Save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quest? This cannot be undone.')) return
    setDeleting(id)
    try {
      await fetch('/api/quests/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchData()
    } catch (err) {
      console.error('Delete error:', err)
    } finally {
      setDeleting(null)
    }
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-500">Admin access only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:pl-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-white">Quest Admin</h1>
              <p className="text-gray-500 text-sm">Manage quests, rewards, and monitor progress</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all text-sm"
          >
            <Plus size={16} />
            New Quest
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Active Passes', value: stats.activePassCount, icon: Users, color: 'text-cyan-400' },
              { label: 'Total Completions', value: stats.totalCompletions, icon: Trophy, color: 'text-yellow-400' },
              { label: 'Credits Distributed', value: stats.totalRewards, icon: Zap, color: 'text-emerald-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3">
                <s.icon size={24} className={s.color} />
                <div>
                  <p className="text-white font-bold text-xl">{s.value}</p>
                  <p className="text-gray-500 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor modal */}
        {(editing || creating) && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-white font-bold text-lg">{editing ? 'Edit Quest' : 'Create Quest'}</h2>
                <button onClick={() => { setEditing(null); setCreating(false) }} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    placeholder="Quest title..."
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none resize-none h-20"
                    placeholder="What the user needs to do..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                    <select
                      value={form.quest_type}
                      onChange={e => setForm({ ...form, quest_type: e.target.value })}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Reward Credits</label>
                    <input
                      type="number"
                      value={form.credits_reward}
                      onChange={e => setForm({ ...form, credits_reward: parseInt(e.target.value) || 0 })}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Action</label>
                    <select
                      value={form.action}
                      onChange={e => setForm({ ...form, action: e.target.value })}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    >
                      {QUEST_ACTIONS.map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Target</label>
                    <input
                      type="number"
                      value={form.target}
                      onChange={e => setForm({ ...form, target: parseInt(e.target.value) || 1 })}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-400">Active</label>
                  <button
                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                    className={`p-1 rounded-lg transition-colors ${form.is_active ? 'text-emerald-400' : 'text-gray-600'}`}
                  >
                    {form.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !form.title}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 text-sm"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {editing ? 'Update Quest' : 'Create Quest'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quest list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-white/5 border border-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {quests.map(quest => {
              const typeColors: Record<string, string> = {
                daily: 'text-emerald-400',
                weekly: 'text-cyan-400',
                monthly: 'text-purple-400',
                yearly: 'text-amber-400',
              }
              return (
                <div
                  key={quest.id}
                  className={`flex items-center gap-4 p-4 bg-white/5 border rounded-xl transition-all hover:bg-white/10 ${
                    quest.is_active ? 'border-white/10' : 'border-red-500/20 opacity-60'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${typeColors[quest.quest_type] || 'text-gray-400'}`}>
                        {quest.quest_type}
                      </span>
                      {!quest.is_active && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Inactive</span>
                      )}
                    </div>
                    <h3 className="text-white font-semibold text-sm truncate">{quest.title}</h3>
                    <p className="text-gray-500 text-xs truncate">{quest.description}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-yellow-300 text-sm font-bold">
                    <Zap size={14} />
                    {quest.credits_reward}
                  </div>

                  <div className="text-gray-500 text-xs font-mono">
                    {quest.requirement?.action}: {quest.requirement?.target}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(quest)}
                      className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(quest.id)}
                      disabled={deleting === quest.id}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
