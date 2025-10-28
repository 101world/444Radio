'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'

type LibraryItem = {
  id: string
  title: string
  audio_url: string | null
  image_url: string | null
}

type Track = {
  id: string
  name: string
  volume: number // 0..1
  mute: boolean
  solo: boolean
  sourceUrl?: string
  buffer?: AudioBuffer
}

export default function NativeStudioPage() {
  const { user } = useUser()
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Web Audio
  const audioCtxRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const trackGainsRef = useRef<Record<string, GainNode>>({})
  const currentSourcesRef = useRef<Record<string, AudioBufferSourceNode | null>>({})
  const startTimeRef = useRef<number | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('Untitled Project')

  const [tracks, setTracks] = useState<Track[]>([
    { id: 't1', name: 'Track 1', volume: 0.9, mute: false, solo: false },
    { id: 't2', name: 'Track 2', volume: 0.9, mute: false, solo: false },
    { id: 't3', name: 'Track 3', volume: 0.9, mute: false, solo: false },
  ])

  const soloed = useMemo(() => tracks.some(t => t.solo), [tracks])

  const ensureAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = 1
      master.connect(ctx.destination)
      audioCtxRef.current = ctx
      masterGainRef.current = master
    }
    return audioCtxRef.current!
  }, [])

  // Fetch user's library
  useEffect(() => {
    let mounted = true
    async function load() {
      if (!user) return
      try {
        setLoadingLibrary(true)
        setError(null)
        const { data, error } = await supabase
          .from('combined_media')
          .select('id, title, audio_url, image_url')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100)
        if (error) throw error
        if (mounted) setLibrary((data || []).filter(i => !!i.audio_url))
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load library')
      } finally {
        if (mounted) setLoadingLibrary(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [user])

  const decodeUrlToBuffer = useCallback(async (url: string): Promise<AudioBuffer> => {
    const ctx = ensureAudioContext()
    const res = await fetch(url)
    const arr = await res.arrayBuffer()
    return await ctx.decodeAudioData(arr)
  }, [ensureAudioContext])

  const attachTrackGain = useCallback((trackId: string) => {
    const ctx = ensureAudioContext()
    if (!trackGainsRef.current[trackId]) {
      const g = ctx.createGain()
      g.connect(masterGainRef.current!)
      trackGainsRef.current[trackId] = g
    }
    return trackGainsRef.current[trackId]
  }, [ensureAudioContext])

  const updateTrackGain = useCallback((t: Track) => {
    const g = attachTrackGain(t.id)
    const shouldMute = t.mute || (soloed && !t.solo)
    g.gain.value = shouldMute ? 0 : t.volume
  }, [attachTrackGain, soloed])

  useEffect(() => {
    tracks.forEach(updateTrackGain)
  }, [tracks, updateTrackGain])

  const loadTrackFromUrl = useCallback(async (trackId: string, url: string) => {
    try {
      const buffer = await decodeUrlToBuffer(url)
      setTracks(prev => prev.map(t => t.id === trackId ? { ...t, buffer, sourceUrl: url } : t))
    } catch (e) {
      console.error('Failed to decode', e)
    }
  }, [decodeUrlToBuffer])

  const onDropFile = useCallback(async (trackId: string, file: File) => {
    const url = URL.createObjectURL(file)
    await loadTrackFromUrl(trackId, url)
  }, [loadTrackFromUrl])

  const stopAll = useCallback(() => {
    Object.values(currentSourcesRef.current).forEach(src => {
      try { src?.stop() } catch {}
    })
    currentSourcesRef.current = {}
    setIsPlaying(false)
    startTimeRef.current = null
  }, [])

  const playAll = useCallback(() => {
    const ctx = ensureAudioContext()
    stopAll()
    const now = ctx.currentTime
    startTimeRef.current = now
    const sources: Record<string, AudioBufferSourceNode> = {}
    tracks.forEach(t => {
      if (!t.buffer) return
      const src = ctx.createBufferSource()
      src.buffer = t.buffer
      const g = attachTrackGain(t.id)
      src.connect(g)
      src.start(now)
      sources[t.id] = src
    })
    currentSourcesRef.current = sources
    setIsPlaying(true)
  }, [attachTrackGain, ensureAudioContext, stopAll, tracks])

  const togglePlay = useCallback(() => {
    if (isPlaying) stopAll() 
    else playAll()
  }, [isPlaying, playAll, stopAll])

  const serializeProject = (): any => ({
    version: 1,
    name: projectName,
    tracks: tracks.map(t => ({
      id: t.id,
      name: t.name,
      volume: t.volume,
      mute: t.mute,
      solo: t.solo,
      sourceUrl: t.sourceUrl || null,
      duration: t.buffer?.duration || null,
    }))
  })

  const saveProject = useCallback(async () => {
    if (!user) return
    try {
      setSaving(true)
      setSaveMsg(null)
      const res = await fetch('/api/studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName || 'Untitled', data: serializeProject() })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `Save failed (${res.status})`)
      }
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(null), 1500)
    } catch (e: any) {
      setSaveMsg(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [projectName, serializeProject, user])

  // UI helpers
  const handleVolumeChange = (id: string, v: number) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, volume: v } : t))
  }
  const toggleMute = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, mute: !t.mute } : t))
  const toggleSolo = (id: string) => setTracks(prev => prev.map(t => t.id === id ? { ...t, solo: !t.solo } : t))

  // Drag from Library
  const onLibraryDragStart = (e: React.DragEvent, item: LibraryItem) => {
    if (!item.audio_url) return
    e.dataTransfer.setData('text/uri-list', item.audio_url)
    e.dataTransfer.setData('text/plain', JSON.stringify(item))
  }

  const onTrackDrop = async (e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    const url = e.dataTransfer.getData('text/uri-list')
    if (url) {
      await loadTrackFromUrl(trackId, url)
      return
    }
    const files = (e.dataTransfer.files || []) as FileList
    if (files.length > 0) {
      await onDropFile(trackId, files[0])
    }
  }

  const onDragOver = (e: React.DragEvent) => e.preventDefault()

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex h-[calc(100vh-0px)]">
        {/* Left: Sidebar */}
        <aside className="w-80 border-r border-white/10 bg-white/5 backdrop-blur-xl p-4 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-bold">AI Sidebar</h2>
            <p className="text-xs text-gray-400">Generate music and drag into tracks. (Coming soon)</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Your Library</h3>
            {loadingLibrary ? (
              <p className="text-xs text-gray-400">Loading…</p>
            ) : error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : library.length === 0 ? (
              <p className="text-xs text-gray-500">No audio yet. Generate or upload.</p>
            ) : (
              <ul className="space-y-2 pr-2 overflow-y-auto max-h-[50vh]">
                {library.map(item => (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={(e) => onLibraryDragStart(e, item)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-grab active:cursor-grabbing"
                    title="Drag to a track"
                  >
                    <div className="flex items-center gap-2">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-white/10" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">{item.title}</p>
                        <p className="text-[10px] text-gray-500 truncate">{item.audio_url}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Right: DAW area */}
        <main className="flex-1 flex flex-col">
          {/* Transport */}
          <div className="border-b border-white/10 p-3 flex items-center gap-3 bg-white/5 backdrop-blur-xl">
            <button
              onClick={togglePlay}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-sm font-semibold"
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
            <span className="text-xs text-gray-400">Simple multi-track preview. Drag audio into tracks.</span>
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Project name"
                className="bg-black/60 border border-white/10 rounded px-2 py-1 text-xs outline-none"
              />
              <button
                onClick={saveProject}
                disabled={saving || !user}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-50 text-xs"
                title={user ? '' : 'Sign in to save'}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              {saveMsg && <span className="text-xs text-gray-400">{saveMsg}</span>}
            </div>
          </div>

          {/* Tracks */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tracks.map(t => (
              <div key={t.id} className="rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                <div className="flex items-center gap-3 p-2 border-b border-white/10">
                  <div className="w-40 px-2">
                    <p className="font-semibold text-sm truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <button onClick={() => toggleMute(t.id)} className={`px-2 py-1 rounded text-xs ${t.mute ? 'bg-red-600' : 'bg-white/10 hover:bg-white/20'}`}>M</button>
                      <button onClick={() => toggleSolo(t.id)} className={`px-2 py-1 rounded text-xs ${t.solo ? 'bg-yellow-600' : 'bg-white/10 hover:bg-white/20'}`}>S</button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={t.volume}
                        onChange={(e) => handleVolumeChange(t.id, parseFloat(e.target.value))}
                        className="w-24"
                      />
                    </div>
                  </div>
                  <div
                    className="flex-1 h-16 bg-black/40 rounded mr-2 border border-dashed border-white/20 flex items-center justify-center text-xs text-gray-400"
                    onDrop={(e) => onTrackDrop(e, t.id)}
                    onDragOver={onDragOver}
                  >
                    {t.buffer ? (
                      <span>{t.sourceUrl?.split('/').pop()}</span>
                    ) : (
                      <span>Drop audio here (from Library or your files)</span>
                    )}
                  </div>
                  <div className="w-32 px-2 text-right text-xs text-gray-400">
                    {t.buffer ? `${Math.round(t.buffer.duration)}s` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
