'use client'

import { useState, useEffect } from 'react'
import { Loader2, Store, DollarSign, Download, Users, RefreshCw, Music, Tag, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react'

interface Listing {
  id: string
  title: string
  user_id: string
  type: string
  genre: string | null
  artist_name: string | null
  listed_on_earn: boolean
  earn_price: number
  artist_share: number
  admin_share: number
  downloads: number
  created_at: string
  image_url: string | null
  plays: number
  user?: {
    clerk_user_id: string
    username: string
    email: string
    credits: number
    subscription_status: string
    subscription_plan: string
  }
}

interface Transaction {
  id: string
  buyer_id: string
  seller_id: string
  admin_id: string
  track_id: string
  total_cost: number
  artist_share: number
  admin_share: number
  split_stems: boolean
  created_at: string
  buyer_username?: string
  seller_username?: string
  track_title?: string
  transaction_type?: string
  buyer?: { username: string }
  seller?: { username: string }
}

interface ListingFee {
  id: string
  user_id: string
  amount: number
  balance_after: number | null
  type: string
  description: string
  metadata: any
  created_at: string
}

interface Stats {
  totalListed: number
  totalDownloads: number
  totalListingFees: number
  totalAdminRevenue: number
  totalPurchases: number
  uniqueListers: number
}

export default function AdminEarnListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [listingFees, setListingFees] = useState<ListingFee[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'listings' | 'transactions' | 'fees'>('listings')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/earn-listings')
      if (!res.ok) {
        if (res.status === 403) throw new Error('Admin access required')
        throw new Error(`Failed: ${res.status}`)
      }
      const data = await res.json()
      setListings(data.listings || [])
      setTransactions(data.transactions || [])
      setListingFees(data.listingFees || [])
      setStats(data.stats || null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const formatDate = (d: string) => new Date(d).toLocaleString()
  const truncateId = (id: string) => id.length > 12 ? id.slice(0, 6) + '...' + id.slice(-4) : id

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store size={24} className="text-cyan-400" /> Earn Marketplace Admin
            </h1>
            <p className="text-sm text-gray-400 mt-1">Track listings, purchases, and listing fees</p>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-all"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-cyan-400"><Music size={12} /> Listed Tracks</div>
              <p className="text-2xl font-bold text-cyan-300">{stats.totalListed}</p>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-purple-400"><Users size={12} /> Unique Listers</div>
              <p className="text-2xl font-bold text-purple-300">{stats.uniqueListers}</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-emerald-400"><Download size={12} /> Total Downloads</div>
              <p className="text-2xl font-bold text-emerald-300">{stats.totalDownloads}</p>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-yellow-400"><Tag size={12} /> Listing Fees Collected</div>
              <p className="text-2xl font-bold text-yellow-300">{stats.totalListingFees} cr</p>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-orange-400"><DollarSign size={12} /> Admin Revenue</div>
              <p className="text-2xl font-bold text-orange-300">{stats.totalAdminRevenue} cr</p>
            </div>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-center gap-1 text-xs text-blue-400"><TrendingUp size={12} /> Purchases</div>
              <p className="text-2xl font-bold text-blue-300">{stats.totalPurchases}</p>
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

        {/* Tabs */}
        {!loading && (
          <div className="flex gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveTab('listings')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                activeTab === 'listings'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 border-b-0'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Listed Tracks ({listings.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 border-b-0'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('fees')}
              className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-all ${
                activeTab === 'fees'
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 border-b-0'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Listing Fees ({listingFees.length})
            </button>
          </div>
        )}

        {/* LISTED TRACKS TABLE */}
        {!loading && activeTab === 'listings' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {listings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No tracks listed on Earn yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                      <th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Lister</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Split</th>
                      <th className="px-4 py-3">Downloads</th>
                      <th className="px-4 py-3">Plays</th>
                      <th className="px-4 py-3">Listed Date</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {listings.map((l) => (
                      <>
                        <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {l.image_url ? (
                                <img src={l.image_url} alt="" className="w-10 h-10 rounded object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded bg-cyan-500/10 flex items-center justify-center">
                                  <Music size={16} className="text-cyan-400" />
                                </div>
                              )}
                              <div>
                                <span className="text-white font-medium">{l.title}</span>
                                <span className="text-gray-500 text-xs block">{l.genre || 'No genre'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-white font-medium">{l.user?.username || 'Unknown'}</span>
                              <span className="text-gray-500 text-xs block">
                                {l.user?.email || l.user_id.slice(0, 20) + '...'}
                              </span>
                              {l.user?.subscription_plan && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 mt-0.5 inline-block">
                                  {l.user.subscription_plan} ({l.user.subscription_status})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-cyan-300 font-bold">{l.earn_price} cr</span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <div className="space-y-0.5">
                              <div className="text-emerald-400">Artist: {l.artist_share} cr</div>
                              <div className="text-orange-400">Admin: {l.admin_share} cr</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${l.downloads > 0 ? 'text-emerald-300' : 'text-gray-500'}`}>
                              {l.downloads}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{l.plays || 0}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(l.created_at)}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setExpandedRow(expandedRow === l.id ? null : l.id)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              {expandedRow === l.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === l.id && (
                          <tr key={`${l.id}-detail`} className="bg-white/[0.02]">
                            <td colSpan={8} className="px-6 py-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-gray-500">Track ID</span>
                                  <p className="font-mono text-gray-300 break-all">{l.id}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">User ID</span>
                                  <p className="font-mono text-gray-300 break-all">{l.user_id}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Type</span>
                                  <p className="text-gray-300">{l.type}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">User Credits</span>
                                  <p className="text-gray-300">{l.user?.credits ?? 'N/A'}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TRANSACTIONS TABLE */}
        {!loading && activeTab === 'transactions' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No earn transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Track</th>
                      <th className="px-4 py-3">Buyer</th>
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3">Total Cost</th>
                      <th className="px-4 py-3">Artist Share</th>
                      <th className="px-4 py-3">Admin Share</th>
                      <th className="px-4 py-3">Stems?</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            tx.transaction_type === 'purchase'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : tx.transaction_type === 'listing_fee'
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}>
                            {tx.transaction_type || 'purchase'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-white">{tx.track_title || truncateId(tx.track_id)}</span>
                            <span className="text-gray-500 text-xs block font-mono">{truncateId(tx.track_id)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white">{tx.buyer_username || tx.buyer?.username || truncateId(tx.buyer_id)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-white">{tx.seller_username || tx.seller?.username || truncateId(tx.seller_id)}</span>
                        </td>
                        <td className="px-4 py-3 text-cyan-300 font-bold">{tx.total_cost} cr</td>
                        <td className="px-4 py-3 text-emerald-400">{tx.artist_share} cr</td>
                        <td className="px-4 py-3 text-orange-400">{tx.admin_share} cr</td>
                        <td className="px-4 py-3">
                          {tx.split_stems ? (
                            <span className="text-purple-400 text-xs">Yes</span>
                          ) : (
                            <span className="text-gray-500 text-xs">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(tx.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* LISTING FEES TABLE */}
        {!loading && activeTab === 'fees' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {listingFees.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No listing fee transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-xs text-gray-400">
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">User ID</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Balance After</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Track ID</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listingFees.map((fee) => {
                      const trackId = typeof fee.metadata === 'object' && fee.metadata
                        ? fee.metadata.trackId
                        : typeof fee.metadata === 'string'
                        ? JSON.parse(fee.metadata)?.trackId
                        : null

                      return (
                        <tr key={fee.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-1 rounded ${
                              fee.type === 'earn_list'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {fee.type === 'earn_list' ? 'Fee Paid' : 'Fee Received'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-300">{truncateId(fee.user_id)}</td>
                          <td className="px-4 py-3">
                            <span className={fee.amount < 0 ? 'text-red-400' : 'text-emerald-400'}>
                              {fee.amount > 0 ? '+' : ''}{fee.amount} cr
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400">{fee.balance_after ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-300">{fee.description}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-400">{trackId ? truncateId(trackId) : '—'}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(fee.created_at)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
