'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_CLERK_ID } from '@/lib/constants'

const ADMIN_ID = ADMIN_CLERK_ID

type Tab = 'overview' | 'users' | 'transactions' | 'redemptions' | 'generations' | 'user-detail'

interface UserRow {
  clerk_user_id: string
  username: string | null
  email: string
  full_name: string | null
  credits: number
  total_generated: number
  wallet_balance: number
  subscription_status: string
  subscription_plan: string | null
  subscription_start: number | null
  subscription_end: number | null
  created_at: string
  [key: string]: unknown
}

interface Transaction {
  id: string
  user_id: string
  amount: number
  balance_after: number | null
  type: string
  status: string
  description: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface Redemption {
  id: string
  clerk_user_id: string
  code: string
  credits_awarded: number
  redeemed_at: string
  redemption_count: number
}

interface PluginJob {
  id: string
  clerk_user_id: string
  type: string
  status: string
  credits_cost: number
  error: string | null
  created_at: string
  completed_at: string | null
}

interface MediaItem {
  id: string
  title: string
  type: string
  plays: number
  likes: number
  genre: string | null
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiData = Record<string, any>

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatEpoch(e: number | null) {
  if (!e) return '—'
  return new Date(e * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Badge({ text, color }: { text: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors[color] || colors.gray}`}>
      {text}
    </span>
  )
}

function subStatusColor(s: string) {
  if (s === 'active') return 'green'
  if (s === 'cancelled') return 'yellow'
  if (s === 'expired') return 'red'
  return 'gray'
}

function walletStatusColor(balance: number) {
  if (balance >= 10) return 'cyan'
  if (balance >= 1) return 'green'
  if (balance > 0) return 'yellow'
  return 'gray'
}

function walletStatusText(balance: number) {
  if (balance >= 1) return 'active'
  if (balance > 0) return 'limited'
  return 'no access'
}

function txnTypeBadge(t: string) {
  if (t.startsWith('generation_')) return 'purple'
  if (t.startsWith('earn_') || t === 'credit_award' || t === 'subscription_bonus' || t === 'code_claim') return 'green'
  if (t === 'credit_refund') return 'cyan'
  if (t === 'release') return 'yellow'
  return 'gray'
}

function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: string }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-5 hover:border-cyan-500/30 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-3xl font-black text-white">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const pages = Math.ceil(total / limit)
  if (pages <= 1) return null
  return (
    <div className="flex items-center gap-2 mt-4 justify-center">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs disabled:opacity-30 hover:bg-gray-700 transition">← Prev</button>
      <span className="text-xs text-gray-400">Page {page} of {pages} ({total} total)</span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-xs disabled:opacity-30 hover:bg-gray-700 transition">Next →</button>
    </div>
  )
}

export default function AdminBillingPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [txnTypeFilter, setTxnTypeFilter] = useState<string>('')

  const isAdmin = isLoaded && user?.id === ADMIN_ID

  const fetchData = useCallback(async (t: Tab, p: number, userId?: string | null, txnType?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ tab: t, page: String(p), limit: '50' })
      if (userId) params.set('userId', userId)
      if (txnType) params.set('type', txnType)
      const res = await fetch(`/api/adminrizzog?${params}`)
      if (!res.ok) {
        let errMsg = `HTTP ${res.status}`
        try { const err = await res.json(); errMsg = err.error || errMsg } catch {}
        throw new Error(errMsg)
      }
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (!isAdmin) return
    if (tab === 'user-detail' && selectedUser) {
      fetchData('user-detail', 1, selectedUser)
    } else {
      fetchData(tab, page, null, txnTypeFilter)
    }
  }, [isLoaded, isAdmin, tab, page, selectedUser, txnTypeFilter, fetchData])

  // Not loaded yet
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-black text-white mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm">You don&apos;t have permission to view this page.</p>
          <button onClick={() => router.push('/')} className="mt-6 px-6 py-2 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition text-sm">
            Go Home
          </button>
        </div>
      </div>
    )
  }

  function switchTab(t: Tab) {
    setTab(t)
    setPage(1)
    setSelectedUser(null)
    setData(null)
  }

  function viewUser(userId: string) {
    setSelectedUser(userId)
    setTab('user-detail')
    setPage(1)
    setData(null)
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'transactions', label: 'Transactions', icon: '💳' },
    { key: 'redemptions', label: 'Redemptions', icon: '🎟️' },
    { key: 'generations', label: 'Plugin Jobs', icon: '🤖' },
  ]

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 border-b border-cyan-500/20">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                444 Radio — Admin Billing
              </h1>
              <p className="text-xs text-gray-500 mt-1">Wallet • Transactions • Subscriptions • Analytics</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Signed in as admin</span>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-xs font-bold">A</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-950 border-b border-gray-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                tab === t.key || (tab === 'user-detail' && t.key === 'users')
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
          {tab === 'user-detail' && (
            <div className="flex items-center px-4 text-xs text-purple-400 font-semibold">
              → User Detail
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 text-red-400 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'overview' && data && <OverviewTab data={data} onViewUser={viewUser} />}
            {tab === 'users' && data && <UsersTab data={data} page={page} onPage={setPage} onViewUser={viewUser} />}
            {tab === 'transactions' && data && (
              <TransactionsTab data={data} page={page} onPage={setPage} typeFilter={txnTypeFilter} setTypeFilter={setTxnTypeFilter} onViewUser={viewUser} />
            )}
            {tab === 'redemptions' && data && <RedemptionsTab data={data} page={page} onPage={setPage} onViewUser={viewUser} />}
            {tab === 'generations' && data && <GenerationsTab data={data} page={page} onPage={setPage} onViewUser={viewUser} />}
            {tab === 'user-detail' && data && <UserDetailTab data={data} onBack={() => switchTab('users')} />}
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════ OVERVIEW TAB ═══════════
function OverviewTab({ data, onViewUser }: { data: ApiData; onViewUser: (id: string) => void }) {
  const { totalUsers, totalMedia, totalCreditsInSystem, totalCreditsAwarded, totalCreditsSpent, adminWalletTotal, adminWalletRemaining, mediaByType, topUsers, paidUsers, recentTransactions, recentAwards } = data

  return (
    <div className="space-y-8">
      {/* ── Admin Wallet Card ── */}
      <div className="bg-gradient-to-br from-cyan-950/40 via-gray-900/80 to-purple-950/30 border border-cyan-500/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-3 right-4 text-5xl opacity-10">💎</div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20">
            💰
          </div>
          <div>
            <h2 className="text-lg font-black text-white tracking-tight">Admin Wallet</h2>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest">444 Billion Credits Allocation</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/10">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Total Allocation</div>
            <div className="text-2xl font-black text-white">{(adminWalletTotal || 444_000_000_000).toLocaleString()}</div>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-emerald-500/10">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Credits Distributed</div>
            <div className="text-2xl font-black text-emerald-400">{(totalCreditsAwarded || 0).toLocaleString()}</div>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-red-500/10">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Credits Spent by Users</div>
            <div className="text-2xl font-black text-red-400">{(totalCreditsSpent || 0).toLocaleString()}</div>
          </div>
          <div className="bg-black/30 rounded-xl p-4 border border-purple-500/10">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Wallet Remaining</div>
            <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              {(adminWalletRemaining || 0).toLocaleString()}
            </div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-[10px] text-gray-500 mb-1">
            <span>Distributed</span>
            <span>{((totalCreditsAwarded || 0) / (adminWalletTotal || 444_000_000_000) * 100).toFixed(6)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, ((totalCreditsAwarded || 0) / (adminWalletTotal || 444_000_000_000)) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="👥" label="Total Users" value={totalUsers} />
        <StatCard icon="🎵" label="Total Media" value={totalMedia} />
        <StatCard icon="💰" label="Credits in System" value={totalCreditsInSystem} />
        <StatCard icon="📦" label="Media Types" value={Object.keys(mediaByType || {}).length} />
      </div>

      {/* Media Breakdown */}
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">📦 Media by Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(mediaByType || {}).map(([type, count]) => (
            <div key={type} className="bg-gray-800/50 rounded-lg p-3 text-center">
              <div className="text-lg font-black text-white">{(count as number).toLocaleString()}</div>
              <div className="text-[10px] text-gray-400 uppercase">{type}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Top Users + Active Subscribers */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🏆 Top Users by Credits</h3>
          <div className="space-y-2">
            {(topUsers || []).map((u: UserRow, i: number) => (
              <button
                key={u.clerk_user_id}
                onClick={() => onViewUser(u.clerk_user_id)}
                className="w-full flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2.5 hover:bg-gray-700/50 transition text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-mono w-5">{i + 1}.</span>
                  <div>
                    <span className="text-sm font-semibold text-white">{u.username || u.email}</span>
                    <br />
                    <span className="text-[10px] text-gray-500">{u.total_generated} generated</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-cyan-400">{u.credits.toLocaleString()}</span>
                  <br />
                  <Badge text={`$${(u.wallet_balance || 0).toFixed(2)}`} color={walletStatusColor(u.wallet_balance || 0)} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Paid Users ($1+ wallet balance = has access) */}
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">💰 Paid Users</h3>
          {(paidUsers || []).length === 0 ? (
            <p className="text-gray-500 text-sm">No paid users</p>
          ) : (
            <div className="space-y-2">
              {(paidUsers || []).map((u: UserRow) => (
                <button
                  key={u.clerk_user_id}
                  onClick={() => onViewUser(u.clerk_user_id)}
                  className="w-full flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2.5 hover:bg-gray-700/50 transition text-left"
                >
                  <div>
                    <span className="text-sm font-semibold text-white">{u.username || u.email}</span>
                    <br />
                    <span className="text-[10px] text-gray-500">
                      ${(u.wallet_balance || 0).toFixed(2)} in wallet
                    </span>
                  </div>
                  <div className="text-right">
                    <Badge text={walletStatusText(u.wallet_balance || 0)} color={walletStatusColor(u.wallet_balance || 0)} />
                    <br />
                    <span className="text-[10px] text-gray-500">{u.credits} credits</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Credit Purchases (who deposited real $$$) ── */}
      <div className="bg-gradient-to-br from-green-950/30 via-gray-900/80 to-gray-900/80 border border-green-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-3 right-4 text-5xl opacity-10">💳</div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-xl shadow-lg shadow-green-500/20">
            💳
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight uppercase">Credit Purchases</h2>
            <p className="text-[10px] text-gray-400">Who bought credits (wallet deposits)</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xl font-black text-emerald-400">${(data.totalDeposited || 0).toFixed(2)}</div>
            <div className="text-[10px] text-gray-500">{data.totalCreditPurchases || 0} deposits</div>
          </div>
        </div>
        {(data.creditPurchases || []).length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">No credit purchases yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">User</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-right py-2 px-2">Credits</th>
                </tr>
              </thead>
              <tbody>
                {(data.creditPurchases || []).slice(0, 20).map((tx: Transaction) => {
                  const meta = (tx.metadata || {}) as Record<string, unknown>
                  const usd = parseFloat((meta.deposit_usd || meta.amount_usd || meta.deposit_amount || '0') as string)
                  return (
                    <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                      <td className="py-2 px-2">
                        <button onClick={() => onViewUser(tx.user_id)} className="text-cyan-400 hover:text-cyan-300 font-mono text-[10px]">
                          {tx.user_id.slice(0, 16)}...
                        </button>
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-green-400">${usd.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right font-bold text-emerald-400">+{tx.amount}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🔄 Recent Transactions</h3>
        <TransactionTable rows={recentTransactions || []} onViewUser={onViewUser} />
      </div>

      {/* Credit Awards — every incoming credit flow */}
      <div className="bg-gradient-to-br from-emerald-950/20 via-gray-900/80 to-gray-900/80 border border-emerald-500/20 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎁</span>
          <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">Credit Awards &amp; Income</h3>
          <span className="text-[10px] text-gray-500 ml-auto">Deposits, codes, refunds — all incoming credits</span>
        </div>
        {(recentAwards || []).length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">No credit awards found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">User</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-right py-2 px-2">Credits</th>
                  <th className="text-right py-2 px-2">Balance After</th>
                  <th className="text-left py-2 px-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {(recentAwards || []).map((tx: Transaction) => (
                  <tr key={tx.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                    <td className="py-2 px-2">
                      <button onClick={() => onViewUser(tx.user_id)} className="text-cyan-400 hover:text-cyan-300 font-mono text-[10px]">
                        {tx.user_id.slice(0, 16)}...
                      </button>
                    </td>
                    <td className="py-2 px-2">
                      <Badge text={tx.type} color={tx.type === 'wallet_deposit' ? 'green' : tx.type === 'wallet_conversion' ? 'cyan' : tx.type === 'code_claim' ? 'purple' : tx.type === 'credit_refund' ? 'yellow' : 'green'} />
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-emerald-400">+{tx.amount}</td>
                    <td className="py-2 px-2 text-right text-gray-400">{tx.balance_after ?? '—'}</td>
                    <td className="py-2 px-2 text-gray-400 max-w-[250px] truncate">{tx.description || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════ USERS TAB ═══════════
function UsersTab({ data, page, onPage, onViewUser }: { data: ApiData; page: number; onPage: (p: number) => void; onViewUser: (id: string) => void }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
      <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">👥 All Users ({data.total})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
              <th className="text-left py-3 px-3">User</th>
              <th className="text-left py-3 px-2">Email</th>
              <th className="text-right py-3 px-2">Credits</th>
              <th className="text-right py-3 px-2">Generated</th>
              <th className="text-center py-3 px-2">Wallet</th>
              <th className="text-center py-3 px-2">Access</th>
              <th className="text-right py-3 px-2">Joined</th>
              <th className="text-center py-3 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {(data.data || []).map((u: UserRow) => (
              <tr key={u.clerk_user_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="py-2.5 px-3">
                  <span className="font-semibold text-white">{u.username || '—'}</span>
                  <br />
                  <span className="text-[10px] text-gray-600 font-mono">{u.clerk_user_id.slice(0, 16)}...</span>
                </td>
                <td className="py-2.5 px-2 text-gray-400">{u.email}</td>
                <td className="py-2.5 px-2 text-right font-bold text-cyan-400">{u.credits.toLocaleString()}</td>
                <td className="py-2.5 px-2 text-right text-gray-300">{u.total_generated}</td>
                <td className="py-2.5 px-2 text-center text-emerald-400 font-mono">
                  ${(u.wallet_balance || 0).toFixed(2)}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <Badge text={walletStatusText(u.wallet_balance || 0)} color={walletStatusColor(u.wallet_balance || 0)} />
                </td>
                <td className="py-2.5 px-2 text-right text-gray-500">{formatDate(u.created_at).split(',')[0]}</td>
                <td className="py-2.5 px-2 text-center">
                  <button onClick={() => onViewUser(u.clerk_user_id)} className="text-cyan-400 hover:text-cyan-300 transition font-semibold">
                    View →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} limit={data.limit} onPage={onPage} />
    </div>
  )
}

// ═══════════ TRANSACTIONS TAB ═══════════
function TransactionsTab({ data, page, onPage, typeFilter, setTypeFilter, onViewUser }: {
  data: ApiData; page: number; onPage: (p: number) => void; typeFilter: string; setTypeFilter: (t: string) => void; onViewUser: (id: string) => void
}) {
  const txnTypes = [
    '', 'generation_music', 'generation_effects', 'generation_loops', 'generation_image',
    'generation_video_to_audio', 'generation_cover_art', 'generation_stem_split', 'generation_audio_boost',
    'generation_extract', 'earn_list', 'earn_purchase', 'earn_sale', 'earn_admin', 'credit_award',
    'credit_refund', 'subscription_bonus', 'release', 'code_claim', 'other'
  ]

  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">💳 Transactions ({data.total})</h3>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); onPage(1) }}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"
        >
          {txnTypes.map(t => (
            <option key={t} value={t}>{t || 'All Types'}</option>
          ))}
        </select>
      </div>
      <TransactionTable rows={data.data || []} onViewUser={onViewUser} />
      <Pagination page={page} total={data.total} limit={data.limit} onPage={onPage} />
    </div>
  )
}

// ═══════════ TRANSACTION TABLE (shared) ═══════════
function TransactionTable({ rows, onViewUser }: { rows: Transaction[]; onViewUser: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Extract human-readable detail from metadata
  function metadataDetail(tx: Transaction): { label: string; details: { key: string; value: string }[] } | null {
    const m = tx.metadata
    if (!m || Object.keys(m).length === 0) return null

    const details: { key: string; value: string }[] = []
    const type = tx.type

    // Code redemption
    if (type === 'code_claim' || type === 'credit_award') {
      if (m.code_name || m.code) details.push({ key: 'Code', value: String(m.code_name || m.code || '—') })
      if (m.source === 'decrypt' || m.decrypt) details.push({ key: 'Source', value: '🔓 Decrypt Page' })
      if (m.source) details.push({ key: 'Source', value: String(m.source) })
    }

    // Subscription
    if (type === 'subscription_bonus') {
      if (m.plan_type) details.push({ key: 'Plan', value: String(m.plan_type).toUpperCase() })
      if (m.plan_id) details.push({ key: 'Plan ID', value: String(m.plan_id) })
      if (m.credit_source) details.push({ key: 'Credit Source', value: String(m.credit_source) })
      if (m.paid_count != null) details.push({ key: 'Billing Cycle', value: `#${m.paid_count}` })
      if (m.subscription_id) details.push({ key: 'Sub ID', value: String(m.subscription_id) })
      if (m.blocked_reason) details.push({ key: '⚠️ Blocked', value: String(m.blocked_reason) })
    }

    // Generation
    if (type.startsWith('generation_')) {
      if (m.generation_type) details.push({ key: 'Type', value: String(m.generation_type) })
      if (m.prompt) details.push({ key: 'Prompt', value: String(m.prompt).slice(0, 80) })
      if (m.model) details.push({ key: 'Model', value: String(m.model) })
      if (m.duration) details.push({ key: 'Duration', value: `${m.duration}s` })
    }

    // Razorpay payment info
    if (m.razorpay_id) details.push({ key: 'Razorpay ID', value: String(m.razorpay_id) })
    if (m.payment_amount) details.push({ key: 'Payment', value: `₹${(Number(m.payment_amount) / 100).toFixed(2)}` })
    if (m.event_type) details.push({ key: 'Event', value: String(m.event_type) })
    if (m.previous_balance != null) details.push({ key: 'Prev Balance', value: String(m.previous_balance) })

    // Generic metadata fallback — show any remaining keys
    const shownKeys = new Set(details.map(d => d.key.toLowerCase()))
    const skipKeys = new Set(['code_name', 'code', 'source', 'decrypt', 'plan_type', 'plan_id', 'credit_source', 'paid_count', 'subscription_id', 'blocked_reason', 'generation_type', 'prompt', 'model', 'duration', 'razorpay_id', 'payment_amount', 'event_type', 'previous_balance', 'subscription_status', 'customer_id'])
    for (const [k, v] of Object.entries(m)) {
      if (!skipKeys.has(k) && !shownKeys.has(k.toLowerCase()) && v != null && v !== '') {
        details.push({ key: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), value: String(v).slice(0, 100) })
      }
    }

    if (details.length === 0) return null

    // Label
    let label = 'Details'
    if (type === 'code_claim' || (type === 'credit_award' && (m.code_name || m.code))) label = '🎟️ Code Redemption'
    else if (type === 'credit_award' && m.source === 'decrypt') label = '🔓 Decrypt Unlock'
    else if (type === 'subscription_bonus') label = '💳 Subscription'
    else if (type.startsWith('generation_')) label = '🎵 Generation'
    else if (type === 'credit_refund') label = '↩️ Refund'
    else if (type === 'admin_adjustment') label = '⚙️ Admin Adjustment'

    return { label, details }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
            <th className="text-left py-2 px-2 w-4"></th>
            <th className="text-left py-2 px-2">Date</th>
            <th className="text-left py-2 px-2">User</th>
            <th className="text-left py-2 px-2">Type</th>
            <th className="text-right py-2 px-2">Amount</th>
            <th className="text-right py-2 px-2">Balance</th>
            <th className="text-left py-2 px-2">Description</th>
            <th className="text-center py-2 px-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const detail = metadataDetail(tx)
            const isExpanded = expandedId === tx.id
            return (
              <Fragment key={tx.id}>
                <tr className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition ${detail ? 'cursor-pointer' : ''}`}
                    onClick={() => detail && setExpandedId(isExpanded ? null : tx.id)}>
                  <td className="py-2 px-1 text-gray-600 text-center">
                    {detail ? (isExpanded ? '▾' : '▸') : ''}
                  </td>
                  <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(tx.created_at)}</td>
                  <td className="py-2 px-2">
                    <button onClick={(e) => { e.stopPropagation(); onViewUser(tx.user_id) }} className="text-cyan-400 hover:text-cyan-300 font-mono text-[10px]">
                      {tx.user_id.slice(0, 16)}...
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <Badge text={tx.type} color={txnTypeBadge(tx.type)} />
                  </td>
                  <td className={`py-2 px-2 text-right font-bold ${tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-400">{tx.balance_after ?? '—'}</td>
                  <td className="py-2 px-2 text-gray-400 max-w-[200px] truncate">{tx.description || '—'}</td>
                  <td className="py-2 px-2 text-center">
                    <Badge text={tx.status} color={tx.status === 'success' ? 'green' : tx.status === 'failed' ? 'red' : 'yellow'} />
                  </td>
                </tr>
                {/* Expandable metadata row */}
                {isExpanded && detail && (
                  <tr className="bg-gray-800/40">
                    <td colSpan={8} className="py-3 px-4">
                      <div className="flex flex-wrap gap-x-6 gap-y-2 items-start">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{detail.label}</span>
                        {detail.details.map(({ key, value }) => (
                          <div key={key} className="flex gap-1.5 items-baseline">
                            <span className="text-[10px] text-gray-500">{key}:</span>
                            <span className="text-[11px] text-gray-300 font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-8 text-center text-gray-600">No transactions found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════ REDEMPTIONS TAB ═══════════
function RedemptionsTab({ data, page, onPage, onViewUser }: { data: ApiData; page: number; onPage: (p: number) => void; onViewUser: (id: string) => void }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
      <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🎟️ Code Redemptions ({data.total})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-3">Date</th>
              <th className="text-left py-2 px-3">User</th>
              <th className="text-left py-2 px-3">Code</th>
              <th className="text-right py-2 px-3">Credits</th>
              <th className="text-right py-2 px-3">Count</th>
            </tr>
          </thead>
          <tbody>
            {(data.data || []).map((r: Redemption) => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                <td className="py-2.5 px-3 text-gray-500">{formatDate(r.redeemed_at)}</td>
                <td className="py-2.5 px-3">
                  <button onClick={() => onViewUser(r.clerk_user_id)} className="text-cyan-400 hover:text-cyan-300 font-mono text-[10px]">
                    {r.clerk_user_id.slice(0, 20)}...
                  </button>
                </td>
                <td className="py-2.5 px-3">
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono text-[10px]">
                    {r.code}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-400">+{r.credits_awarded}</td>
                <td className="py-2.5 px-3 text-right text-gray-400">{r.redemption_count}×</td>
              </tr>
            ))}
            {(data.data || []).length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-gray-600">No redemptions found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} limit={data.limit} onPage={onPage} />
    </div>
  )
}

// ═══════════ GENERATIONS (PLUGIN JOBS) TAB ═══════════
function GenerationsTab({ data, page, onPage, onViewUser }: { data: ApiData; page: number; onPage: (p: number) => void; onViewUser: (id: string) => void }) {
  return (
    <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
      <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🤖 Plugin Jobs ({data.total})</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
              <th className="text-left py-2 px-2">Date</th>
              <th className="text-left py-2 px-2">User</th>
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-center py-2 px-2">Status</th>
              <th className="text-right py-2 px-2">Credits</th>
              <th className="text-left py-2 px-2">Error</th>
              <th className="text-right py-2 px-2">Duration</th>
            </tr>
          </thead>
          <tbody>
            {(data.data || []).map((j: PluginJob) => {
              const dur = j.completed_at && j.created_at
                ? Math.round((new Date(j.completed_at).getTime() - new Date(j.created_at).getTime()) / 1000)
                : null
              return (
                <tr key={j.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                  <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(j.created_at)}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => onViewUser(j.clerk_user_id)} className="text-cyan-400 hover:text-cyan-300 font-mono text-[10px]">
                      {j.clerk_user_id.slice(0, 16)}...
                    </button>
                  </td>
                  <td className="py-2 px-2">
                    <Badge text={j.type} color="purple" />
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Badge text={j.status} color={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : 'yellow'} />
                  </td>
                  <td className="py-2 px-2 text-right font-bold text-gray-300">{j.credits_cost}</td>
                  <td className="py-2 px-2 text-red-400 max-w-[150px] truncate">{j.error || '—'}</td>
                  <td className="py-2 px-2 text-right text-gray-500">{dur !== null ? `${dur}s` : '—'}</td>
                </tr>
              )
            })}
            {(data.data || []).length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-gray-600">No plugin jobs found</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={data.total} limit={data.limit} onPage={onPage} />
    </div>
  )
}

// ═══════════ USER DETAIL TAB ═══════════
function UserDetailTab({ data, onBack }: { data: ApiData; onBack: () => void }) {
  const { user, transactions, media, pluginJobs, redemptions } = data

  if (!user) {
    return <div className="text-gray-500 text-center py-10">User not found</div>
  }

  return (
    <div className="space-y-6">
      {/* Back button + User header */}
      <button onClick={onBack} className="text-xs text-cyan-400 hover:text-cyan-300 transition font-semibold">
        ← Back to Users
      </button>

      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-white">{user.username || user.full_name || 'Unknown'}</h2>
            <p className="text-sm text-gray-400">{user.email}</p>
            <p className="text-[10px] text-gray-600 font-mono mt-1">{user.clerk_user_id}</p>
          </div>
          <div className="flex gap-4">
            <div className="text-center bg-gray-800/50 rounded-lg px-4 py-3">
              <div className="text-2xl font-black text-cyan-400">{(user.credits || 0).toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">Credits</div>
            </div>
            <div className="text-center bg-gray-800/50 rounded-lg px-4 py-3">
              <div className="text-2xl font-black text-white">{(user.total_generated || 0).toLocaleString()}</div>
              <div className="text-[10px] text-gray-500">Generated</div>
            </div>
            <div className="text-center bg-gray-800/50 rounded-lg px-4 py-3">
              <div className="text-2xl font-black text-emerald-400">${(user.wallet_balance || 0).toFixed(2)}</div>
              <div className="text-[10px] text-gray-500">Wallet</div>
            </div>
            <div className="text-center bg-gray-800/50 rounded-lg px-4 py-3">
              <div className="text-lg font-bold">
                <Badge text={walletStatusText(user.wallet_balance || 0)} color={walletStatusColor(user.wallet_balance || 0)} />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Access</div>
            </div>
          </div>
        </div>
        {(user.wallet_balance || 0) >= 1 && (
          <div className="mt-4 bg-emerald-900/20 border border-emerald-500/20 rounded-lg p-3 text-xs text-gray-400">
            💰 Wallet Balance: <span className="text-emerald-300 font-bold">${(user.wallet_balance || 0).toFixed(2)}</span> • 
            Access: <span className="text-emerald-300">Active ($1+ deposited)</span>
          </div>
        )}
        <div className="mt-3 text-xs text-gray-500">
          Joined: {formatDate(user.created_at)} • Followers: {user.follower_count || 0} • Following: {user.following_count || 0}
          {user.bio && <> • Bio: <span className="text-gray-400">{user.bio}</span></>}
        </div>
      </div>

      {/* Wallet: Transaction History */}
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
        <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">💰 Transaction History ({transactions.length})</h3>
        <TransactionTable rows={transactions} onViewUser={() => {}} />
      </div>

      {/* Code Redemptions */}
      {redemptions.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🎟️ Code Redemptions</h3>
          <div className="space-y-2">
            {redemptions.map((r: Redemption) => (
              <div key={r.id} className="flex items-center justify-between bg-gray-800/40 rounded-lg px-4 py-2">
                <div>
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-mono text-[10px]">
                    {r.code}
                  </span>
                  <span className="text-gray-500 text-[10px] ml-2">{formatDate(r.redeemed_at)}</span>
                </div>
                <span className="text-emerald-400 font-bold text-sm">+{r.credits_awarded}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media */}
      {media.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🎵 Content ({media.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Title</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-left py-2 px-2">Genre</th>
                  <th className="text-right py-2 px-2">Plays</th>
                  <th className="text-right py-2 px-2">Likes</th>
                  <th className="text-right py-2 px-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {media.map((m: MediaItem) => (
                  <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="py-2 px-2 text-white font-medium max-w-[200px] truncate">{m.title || '—'}</td>
                    <td className="py-2 px-2"><Badge text={m.type} color="cyan" /></td>
                    <td className="py-2 px-2 text-gray-400">{m.genre || '—'}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{m.plays}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{m.likes}</td>
                    <td className="py-2 px-2 text-right text-gray-500">{formatDate(m.created_at).split(',')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Plugin Jobs */}
      {pluginJobs.length > 0 && (
        <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-6">
          <h3 className="text-sm font-bold text-gray-300 mb-4 uppercase tracking-wider">🤖 Plugin Jobs ({pluginJobs.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-700/50 text-gray-500 uppercase tracking-wider">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Type</th>
                  <th className="text-center py-2 px-2">Status</th>
                  <th className="text-right py-2 px-2">Credits</th>
                  <th className="text-right py-2 px-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {pluginJobs.map((j: PluginJob) => {
                  const dur = j.completed_at && j.created_at
                    ? Math.round((new Date(j.completed_at).getTime() - new Date(j.created_at).getTime()) / 1000)
                    : null
                  return (
                    <tr key={j.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="py-2 px-2 text-gray-500">{formatDate(j.created_at)}</td>
                      <td className="py-2 px-2"><Badge text={j.type} color="purple" /></td>
                      <td className="py-2 px-2 text-center">
                        <Badge text={j.status} color={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : 'yellow'} />
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-gray-300">{j.credits_cost}</td>
                      <td className="py-2 px-2 text-right text-gray-500">{dur !== null ? `${dur}s` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
