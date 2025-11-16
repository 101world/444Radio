'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface R2Status {
  success: boolean
  message?: string
  error?: string
  config?: {
    endpoint: string
    bucketName: string
    publicUrls?: {
      audio?: string
      images?: string
      videos?: string
    }
  }
  objectCount?: number
}

export default function R2StatusIndicator() {
  const [status, setStatus] = useState<R2Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    checkR2Status()
  }, [])

  const checkR2Status = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/r2/test-connection')
      const data = await res.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        success: false,
        error: 'Failed to check R2 connection'
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking R2...</span>
      </div>
    )
  }

  if (!status) return null

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-lg p-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2">
          {status.success ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-red-500" />
          )}
          <div>
            <div className="text-sm font-medium text-white">
              R2 Storage {status.success ? 'Connected' : 'Disconnected'}
            </div>
            {status.success && status.objectCount !== undefined && (
              <div className="text-xs text-gray-400">
                {status.objectCount} objects in bucket
              </div>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-500">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2 text-xs">
          {status.error && (
            <div className="flex items-start gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{status.error}</span>
            </div>
          )}
          
          {status.config && (
            <div className="space-y-1 text-gray-400">
              <div>
                <span className="text-gray-500">Bucket:</span> {status.config.bucketName}
              </div>
              <div>
                <span className="text-gray-500">Endpoint:</span>{' '}
                <span className="text-xs font-mono break-all">
                  {status.config.endpoint}
                </span>
              </div>
              {status.config.publicUrls && (
                <div className="pt-2 space-y-1">
                  <div className="text-gray-500 font-medium">Public URLs:</div>
                  {status.config.publicUrls.audio && (
                    <div className="pl-2">
                      <span className="text-teal-400">Audio:</span>{' '}
                      <span className="text-xs font-mono break-all">
                        {status.config.publicUrls.audio}
                      </span>
                    </div>
                  )}
                  {status.config.publicUrls.images && (
                    <div className="pl-2">
                      <span className="text-purple-400">Images:</span>{' '}
                      <span className="text-xs font-mono break-all">
                        {status.config.publicUrls.images}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            onClick={checkR2Status}
            className="mt-2 px-3 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-md text-xs font-medium transition-colors"
          >
            Refresh Status
          </button>
        </div>
      )}
    </div>
  )
}
