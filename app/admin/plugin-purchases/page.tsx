'use client'

import { useState, useEffect } from 'react'
import { Loader2, DollarSign, CheckCircle, Clock, RefreshCw } from 'lucide-react'

interface Purchase {
  id: string
  clerk_user_id: string
  order_id: string
  payment_id: string
  amount: number
  currency: string
  status: string
  created_at: string
  updated_at: string
  user?: {
    username: string
    email: string
    subscription_plan: string
    subscription_status: string
  }
}

interface Stats {
  total: number
  completed: number
  pending: number
  revenue: number
  revenueDisplay: string
}

export default function AdminPluginPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPurchases = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/plugin-purchases')
      if (!res.ok) {
        if (res.status === 403) throw new Error('Admin access required')
        throw new Error(`Failed: ${res.status}`)
      }
      const data = await res.json()
      setPurchases(data.purchases || [])
      setStats(data.stats || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPurchases() }, [])

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Plugin Purchases</h1>
          <button onClick={fetchPurchases} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-xs text-gray-400">Total Orders</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <p className="text-xs text-emerald-400">Completed</p>
              <p className="text-2xl font-bold text-emerald-300">{stats.completed}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-xs text-yellow-400">Pending</p>
              <p className="text-2xl font-bold text-yellow-300">{stats.pending}</p>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-cyan-400"><DollarSign size={12} /> Revenue</div>
              <p className="text-2xl font-bold text-cyan-300">{stats.revenueDisplay}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-cyan-400" size={32} />
          </div>
        )}

        {/* Purchases table */}
        {!loading && purchases.length === 0 && !error && (
          <div className="text-center py-12 text-gray-500">No plugin purchases yet</div>
        )}

        {!loading && purchases.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Payment ID</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-white font-medium">{p.user?.username || 'Unknown'}</span>
                          <span className="text-gray-500 text-xs block">{p.user?.email || p.clerk_user_id.slice(0, 20)}</span>
                          {p.user?.subscription_plan && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 mt-0.5 inline-block">
                              {p.user.subscription_plan} ({p.user.subscription_status})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'completed' ? (
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle size={14} /> Completed</span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-400"><Clock size={14} /> {p.status}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        ${(p.amount / 100).toFixed(2)} {p.currency}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.order_id || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{p.payment_id || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
