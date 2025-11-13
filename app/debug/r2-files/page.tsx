'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface Song {
  source: string
  id: string
  title: string
  audio_url: string
  image_url: string | null
  prompt: string
  lyrics: string | null
  created_at: string
  duration: number | null
}

interface Duplicate {
  audio_url: string
  count: number
  tables: string
  songs: Song[]
}

interface DBData {
  summary: {
    combined_media: number
    combined_media_library: number
    music_library: number
    totalRows: number
    uniqueSongs: number
    duplicateCount: number
    expectedTotal: number
    missing: number
  }
  byTable: {
    combined_media: Song[]
    combined_media_library: Song[]
    music_library: Song[]
  }
  allSongs: Song[]
  duplicates: Duplicate[]
  uniqueUrls: string[]
}

export default function R2DebugPage() {
  const { user } = useUser()
  const [data, setData] = useState<DBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchR2Data()
  }, [])

  const fetchR2Data = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug/list-r2-audio')
      const json = await res.json()
      
      if (json.success) {
        setData(json)
      } else {
        setError(json.error || 'Failed to load R2 data')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Loading R2 Bucket Data...</h1>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-red-500">Error</h1>
          <p>{error}</p>
          <button 
            onClick={fetchR2Data}
            className="mt-4 px-4 py-2 bg-blue-600 rounded"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">R2 Bucket Analysis</h1>
          <Link href="/library" className="text-blue-400 hover:underline">
            ← Back to Library
          </Link>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">Total R2 Files</div>
            <div className="text-3xl font-bold text-blue-400">{data?.summary.totalR2Files || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">In Database</div>
            <div className="text-3xl font-bold text-green-400">{data?.summary.totalInDatabase || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">Orphaned Files</div>
            <div className="text-3xl font-bold text-red-400">{data?.summary.orphanedFiles || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">Expected</div>
            <div className="text-3xl font-bold text-purple-400">40</div>
          </div>
        </div>

        {/* Orphaned Files */}
        {data && data.orphanedFiles.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-red-400">
              🚨 Orphaned Files (In R2 but NOT in Database)
            </h2>
            <div className="bg-gray-900 rounded-lg border border-red-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">File</th>
                      <th className="px-4 py-3 text-left">Size</th>
                      <th className="px-4 py-3 text-left">Modified</th>
                      <th className="px-4 py-3 text-left">URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orphanedFiles.map((file, idx) => (
                      <tr key={file.key} className="border-t border-gray-800 hover:bg-gray-800/50">
                        <td className="px-4 py-3">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-sm">{file.key}</td>
                        <td className="px-4 py-3">{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(file.lastModified).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <a 
                            href={file.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline text-sm"
                          >
                            Play ▶
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* All R2 Files */}
        <div>
          <h2 className="text-2xl font-bold mb-4">All R2 Files</h2>
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">File</th>
                    <th className="px-4 py-3 text-left">Size</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">URL</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.r2Files.map((file, idx) => (
                    <tr key={file.key} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 font-mono text-sm">{file.key}</td>
                      <td className="px-4 py-3">{(file.size / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="px-4 py-3">
                        {file.inDatabase ? (
                          <span className="text-green-400">✓ In DB</span>
                        ) : (
                          <span className="text-red-400">✗ Orphaned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-sm"
                        >
                          Play ▶
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
