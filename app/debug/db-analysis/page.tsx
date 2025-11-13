'use client'

import { useState, useEffect } from 'react'
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

export default function DatabaseDebugPage() {
  const [data, setData] = useState<DBData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'all' | 'duplicates'>('summary')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug/list-r2-audio')
      const json = await res.json()
      
      if (json.success) {
        setData(json)
      } else {
        setError(json.error || 'Failed to load database data')
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
          <h1 className="text-3xl font-bold mb-8">Loading Database Analysis...</h1>
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
            onClick={fetchData}
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
          <h1 className="text-3xl font-bold">Database Analysis</h1>
          <Link href="/library" className="text-blue-400 hover:underline">
            ← Back to Library
          </Link>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">combined_media</div>
            <div className="text-3xl font-bold text-blue-400">{data?.summary.combined_media || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">combined_media_library</div>
            <div className="text-3xl font-bold text-purple-400">{data?.summary.combined_media_library || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">music_library</div>
            <div className="text-3xl font-bold text-cyan-400">{data?.summary.music_library || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-gray-800">
            <div className="text-gray-400 text-sm">Total Rows</div>
            <div className="text-3xl font-bold text-gray-400">{data?.summary.totalRows || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 p-6 rounded-lg border border-green-900">
            <div className="text-gray-400 text-sm">Unique Songs</div>
            <div className="text-3xl font-bold text-green-400">{data?.summary.uniqueSongs || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-yellow-900">
            <div className="text-gray-400 text-sm">Duplicates</div>
            <div className="text-3xl font-bold text-yellow-400">{data?.summary.duplicateCount || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-purple-900">
            <div className="text-gray-400 text-sm">Expected</div>
            <div className="text-3xl font-bold text-purple-400">{data?.summary.expectedTotal || 0}</div>
          </div>
          <div className="bg-gray-900 p-6 rounded-lg border border-red-900">
            <div className="text-gray-400 text-sm">Missing</div>
            <div className="text-3xl font-bold text-red-400">{data?.summary.missing || 0}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'summary'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            By Table
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Songs ({data?.allSongs.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'duplicates'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Duplicates ({data?.duplicates.length || 0})
          </button>
        </div>

        {/* By Table View */}
        {activeTab === 'summary' && data && (
          <div className="space-y-6">
            {['combined_media', 'combined_media_library', 'music_library'].map(tableName => {
              const songs = data.byTable[tableName as keyof typeof data.byTable]
              return (
                <div key={tableName} className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
                  <div className="bg-gray-800 px-6 py-3">
                    <h3 className="text-xl font-bold">{tableName} ({songs.length})</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-850">
                        <tr>
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Title</th>
                          <th className="px-4 py-3 text-left">Created</th>
                          <th className="px-4 py-3 text-left">Audio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {songs.map((song, idx) => (
                          <tr key={song.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                            <td className="px-4 py-3">{idx + 1}</td>
                            <td className="px-4 py-3">{song.title || 'Untitled'}</td>
                            <td className="px-4 py-3 text-sm">
                              {new Date(song.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <a 
                                href={song.audio_url} 
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
              )
            })}
          </div>
        )}

        {/* All Songs View */}
        {activeTab === 'all' && data && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Source</th>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3 text-left">Audio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.allSongs.map((song, idx) => (
                    <tr key={`${song.source}-${song.id}`} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          song.source === 'combined_media' ? 'bg-blue-900 text-blue-300' :
                          song.source === 'combined_media_library' ? 'bg-purple-900 text-purple-300' :
                          'bg-cyan-900 text-cyan-300'
                        }`}>
                          {song.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">{song.title || 'Untitled'}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(song.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <a 
                          href={song.audio_url} 
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
        )}

        {/* Duplicates View */}
        {activeTab === 'duplicates' && data && (
          <div className="space-y-4">
            {data.duplicates.length === 0 ? (
              <div className="bg-gray-900 p-8 rounded-lg border border-gray-800 text-center text-gray-400">
                No duplicate songs found!
              </div>
            ) : (
              data.duplicates.map((dup, idx) => (
                <div key={idx} className="bg-gray-900 rounded-lg border border-yellow-900 overflow-hidden">
                  <div className="bg-yellow-900/20 px-6 py-3">
                    <h3 className="text-lg font-bold text-yellow-400">
                      Duplicate #{idx + 1} - Appears in {dup.count} tables ({dup.tables})
                    </h3>
                    <a 
                      href={dup.audio_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm"
                    >
                      {dup.audio_url}
                    </a>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left">Table</th>
                          <th className="px-4 py-3 text-left">ID</th>
                          <th className="px-4 py-3 text-left">Title</th>
                          <th className="px-4 py-3 text-left">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dup.songs.map((song) => (
                          <tr key={`${song.source}-${song.id}`} className="border-t border-gray-800">
                            <td className="px-4 py-3">
                              <span className="text-xs px-2 py-1 rounded bg-gray-700">
                                {song.source}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-sm">{song.id}</td>
                            <td className="px-4 py-3">{song.title || 'Untitled'}</td>
                            <td className="px-4 py-3 text-sm">
                              {new Date(song.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
