'use client'

import { useState } from 'react'

export default function SyncSubscribersPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function runSync() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/admin/sync-subscribers', {
        method: 'POST'
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to sync')
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Sync Razorpay Subscribers</h1>
        
        <div className="bg-gray-900 p-6 rounded-lg mb-6">
          <p className="mb-4">
            This will fetch all active subscriptions from Razorpay and sync them to your database.
          </p>
          <ul className="list-disc list-inside space-y-2 text-gray-400 mb-6">
            <li>Existing users: +100 credits + activate subscription</li>
            <li>New users: Create placeholder with 100 credits</li>
            <li>When they sign up: Clerk webhook links them automatically</li>
          </ul>
          
          <button
            onClick={runSync}
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold py-3 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Syncing...' : 'Run Sync Now'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 p-4 rounded-lg mb-6">
            <h3 className="font-bold mb-2">Error:</h3>
            <pre className="text-sm overflow-x-auto">{error}</pre>
          </div>
        )}

        {result && (
          <div className="bg-green-900/50 border border-green-500 p-4 rounded-lg">
            <h3 className="font-bold mb-4">Sync Complete!</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-black/50 p-4 rounded">
                <div className="text-2xl font-bold">{result.total}</div>
                <div className="text-sm text-gray-400">Total Subscriptions</div>
              </div>
              <div className="bg-black/50 p-4 rounded">
                <div className="text-2xl font-bold text-green-400">{result.synced}</div>
                <div className="text-sm text-gray-400">Synced Successfully</div>
              </div>
              <div className="bg-black/50 p-4 rounded">
                <div className="text-2xl font-bold text-red-400">{result.errors}</div>
                <div className="text-sm text-gray-400">Errors</div>
              </div>
            </div>

            {result.results && result.results.length > 0 && (
              <div>
                <h4 className="font-bold mb-2">Details:</h4>
                <div className="max-h-96 overflow-y-auto bg-black/50 p-4 rounded">
                  <pre className="text-xs">{JSON.stringify(result.results, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
