'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import FloatingMenu from '../../components/FloatingMenu'

interface DiagnosticData {
  targetUserId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userData: any
  userError: string | null
  combinedMediaCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  combinedMediaSample: any
  profileMediaCount: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileMediaSample: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allUsers: any[]
  diagnosis: {
    hasUserRecord: boolean
    username: string
    clerk_user_id: string
    created_at: string
  }
}

export default function DatabaseDebugPage() {
  const { user } = useUser()
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(false)
  const [customUserId, setCustomUserId] = useState('')
  const [error, setError] = useState('')

  const fetchData = async (userId?: string) => {
    setLoading(true)
    setError('')
    try {
      const url = userId 
        ? `/api/debug/user-data?userId=${userId}` 
        : '/api/debug/user-data'
      
      const res = await fetch(url)
      const result = await res.json()
      
      if (!res.ok) {
        setError(result.error || 'Failed to fetch data')
        return
      }
      
      setData(result)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p>Please sign in to view database debug info</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <FloatingMenu />
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-cyan-400">Database Debug Tool</h1>
        
        {/* User ID Input */}
        <div className="bg-white/5 p-6 rounded-xl mb-6 border border-white/10">
          <h2 className="text-xl font-bold mb-4">Check Specific User</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={customUserId}
              onChange={(e) => setCustomUserId(e.target.value)}
              placeholder="Enter Clerk User ID (e.g., user_34IkVS04YVAZH371HSr3aaZlU60)"
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => fetchData(customUserId)}
              disabled={loading || !customUserId}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-xl font-bold hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 transition-all"
            >
              {loading ? 'Loading...' : 'Check User'}
            </button>
            <button
              onClick={() => {
                setCustomUserId('')
                fetchData()
              }}
              disabled={loading}
              className="px-6 py-3 bg-white/10 rounded-xl font-bold hover:bg-white/20 transition-all"
            >
              Reset to My Data
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded-xl mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Diagnosis Summary */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-cyan-400">🔍 Diagnosis</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Target User ID</p>
                  <p className="font-mono text-sm">{data.targetUserId}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Has User Record?</p>
                  <p className={data.diagnosis.hasUserRecord ? 'text-green-400' : 'text-red-400'}>
                    {data.diagnosis.hasUserRecord ? '✅ YES' : '❌ NO'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Username in DB</p>
                  <p className="font-mono text-sm text-teal-300">{data.diagnosis.username}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Clerk Username (from FloatingMenu)</p>
                  <p className="font-mono text-sm text-cyan-300">@{user.username || 'not set'}</p>
                </div>
              </div>
              
              {/* Username Mismatch Warning */}
              {data.diagnosis.username !== user.username && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 font-semibold mb-2">⚠️ Username Mismatch Detected!</p>
                  <p className="text-sm text-gray-300 mb-3">
                    Database has <span className="font-mono text-yellow-300">{data.diagnosis.username}</span> but Clerk has <span className="font-mono text-cyan-300">{user.username}</span>
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true)
                        const res = await fetch('/api/user/update-username', { method: 'POST' })
                        const result = await res.json()
                        if (res.ok) {
                          alert('✅ Username updated successfully! Reloading...')
                          fetchData()
                        } else {
                          alert('❌ Failed to update: ' + result.error)
                        }
                      } catch (err) {
                        alert('❌ Error: ' + (err as Error).message)
                      } finally {
                        setLoading(false)
                      }
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-black font-bold rounded-lg hover:scale-105 transition-transform"
                  >
                    🔄 Fix Username - Update DB to Match Clerk
                  </button>
                </div>
              )}
            </div>

            {/* User Data */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-cyan-400">👤 User Table Data</h2>
              {data.userData ? (
                <pre className="bg-black/50 p-4 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(data.userData, null, 2)}
                </pre>
              ) : (
                <div className="bg-red-500/20 border border-red-500 p-4 rounded-lg">
                  <p className="text-red-200 font-bold">⚠️ No user record found in database!</p>
                  <p className="text-red-300 text-sm mt-2">Error: {data.userError}</p>
                  <p className="text-gray-400 text-sm mt-4">
                    This user needs to be synced. The sync usually happens automatically on login.
                  </p>
                </div>
              )}
            </div>

            {/* Media Counts */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h3 className="text-lg font-bold mb-2 text-cyan-400">🎵 Combined Media</h3>
                <p className="text-3xl font-bold">{data.combinedMediaCount}</p>
                <p className="text-gray-400 text-sm">tracks</p>
              </div>
              <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h3 className="text-lg font-bold mb-2 text-cyan-400">📸 Profile Media</h3>
                <p className="text-3xl font-bold">{data.profileMediaCount}</p>
                <p className="text-gray-400 text-sm">items</p>
              </div>
            </div>

            {/* All Users List */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-cyan-400">👥 Recent Users in Database</h2>
              <div className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.allUsers.map((u: any, i: number) => (
                  <div key={i} className="bg-black/30 p-3 rounded-lg flex justify-between items-center">
                    <div>
                      <p className="font-mono text-sm text-teal-300">@{u.username}</p>
                      <p className="font-mono text-xs text-gray-500">{u.clerk_user_id}</p>
                    </div>
                    <button
                      onClick={() => {
                        setCustomUserId(u.clerk_user_id)
                        fetchData(u.clerk_user_id)
                      }}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs transition-all"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Media */}
            {data.combinedMediaSample && (
              <div className="bg-white/5 p-6 rounded-xl border border-white/10">
                <h2 className="text-2xl font-bold mb-4 text-cyan-400">🎵 Sample Combined Media</h2>
                <pre className="bg-black/50 p-4 rounded-lg overflow-auto text-xs">
                  {JSON.stringify(data.combinedMediaSample, null, 2)}
                </pre>
              </div>
            )}

            {/* SQL Queries */}
            <div className="bg-white/5 p-6 rounded-xl border border-white/10">
              <h2 className="text-2xl font-bold mb-4 text-cyan-400">📝 Useful SQL Queries</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Check user by Clerk ID:</p>
                  <pre className="bg-black/50 p-3 rounded-lg text-xs overflow-auto">
{`SELECT * FROM users 
WHERE clerk_user_id = '${data.targetUserId}';`}
                  </pre>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Update username:</p>
                  <pre className="bg-black/50 p-3 rounded-lg text-xs overflow-auto">
{`UPDATE users 
SET username = 'rizzitizz' 
WHERE clerk_user_id = '${data.targetUserId}';`}
                  </pre>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">View all users:</p>
                  <pre className="bg-black/50 p-3 rounded-lg text-xs overflow-auto">
{`SELECT clerk_user_id, username, email, created_at 
FROM users 
ORDER BY created_at DESC;`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
