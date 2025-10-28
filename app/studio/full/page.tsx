'use client'

import { useState, useEffect, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { Sparkles, Zap, ChevronLeft, ChevronRight, Music } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type GenerationRequest = {
  id: string
  prompt: string
  status: 'queued' | 'generating' | 'complete' | 'error'
  audioUrl?: string
  imageUrl?: string
}

export default function StudioFullPage() {
  const { user } = useUser()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [editorReady, setEditorReady] = useState(false)
  
  // AI Generation
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLanguage, setAiLanguage] = useState('en')
  const [generations, setGenerations] = useState<GenerationRequest[]>([])
  
  // Library
  const [libraryItems, setLibraryItems] = useState<any[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  
  const scriptsLoadedCount = useRef(0)
  const editorRef = useRef<any>(null)
  
  // Load user's library
  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    
    async function loadLibrary() {
      try {
        setLoadingLibrary(true)
        const { data, error } = await supabase
          .from('combined_media')
          .select('id, title, audio_url, image_url')
          .eq('user_id', user!.id)
          .not('audio_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50)
        
        if (error) throw error
        if (mounted) setLibraryItems(data || [])
      } catch (e) {
        console.error('Failed to load library:', e)
      } finally {
        if (mounted) setLoadingLibrary(false)
      }
    }
    
    loadLibrary()
    return () => { mounted = false }
  }, [user])
  
  // Initialize AudioMass editor once scripts are loaded
  useEffect(() => {
    if (scriptsLoaded && !editorReady) {
      // Wait a bit for DOM to be ready
      setTimeout(() => {
        try {
          if (typeof (window as any).PKAudioEditor !== 'undefined') {
            const editor = (window as any).PKAudioEditor.init('audiomass-container')
            editorRef.current = editor
            setEditorReady(true)
            console.log('AudioMass editor initialized:', editor)
          }
        } catch (e) {
          console.error('Failed to init AudioMass:', e)
        }
      }, 500)
    }
  }, [scriptsLoaded, editorReady])
  
  // Generate AI music
  const generateMusic = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 3) return
    
    const genId = `gen-${Date.now()}`
    const newGen: GenerationRequest = {
      id: genId,
      prompt: aiPrompt,
      status: 'queued'
    }
    
    setGenerations(prev => [newGen, ...prev])
    const promptText = aiPrompt
    setAiPrompt('')
    
    // Update to generating
    setGenerations(prev => prev.map(g => 
      g.id === genId ? { ...g, status: 'generating' } : g
    ))
    
    try {
      const endpoint = aiLanguage === 'en' ? '/api/generate/music' : '/api/generate/music-only'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          language: aiLanguage
        })
      })
      
      if (!response.ok) throw new Error('Generation failed')
      
      const data = await response.json()
      
      setGenerations(prev => prev.map(g => 
        g.id === genId ? { 
          ...g, 
          status: 'complete', 
          audioUrl: data.audioUrl || data.audio_url,
          imageUrl: data.imageUrl || data.image_url 
        } : g
      ))
    } catch (e) {
      console.error('Generation error:', e)
      setGenerations(prev => prev.map(g => 
        g.id === genId ? { ...g, status: 'error' } : g
      ))
    }
  }
  
  // Load audio URL into AudioMass
  const loadAudioUrl = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const file = new File([blob], 'audio.mp3', { type: blob.type })
      
      // AudioMass expects files to be dropped/loaded via its internal handlers
      // We'll trigger the load via the editor instance
      if (editorRef.current && typeof editorRef.current.loadFile === 'function') {
        editorRef.current.loadFile(file)
      } else {
        // Fallback: create a synthetic file input event
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
        if (fileInput) {
          fileInput.files = dataTransfer.files
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    } catch (e) {
      console.error('Failed to load audio:', e)
    }
  }
  
  const handleScriptLoad = () => {
    scriptsLoadedCount.current += 1
    // We have 8 core scripts - when all loaded, we're ready
    if (scriptsLoadedCount.current >= 8) {
      setScriptsLoaded(true)
    }
  }
  
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Music size={64} className="mx-auto mb-4 text-purple-400" />
          <h1 className="text-2xl font-bold mb-2">Welcome to 444Studio</h1>
          <p className="text-gray-400 mb-6">Sign in to start creating</p>
          <button
            onClick={() => router.push('/sign-in')}
            className="px-6 py-3 bg-purple-600 rounded-lg hover:bg-purple-500 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <>
      {/* Load AudioMass Scripts */}
      <Script src="/444studio/dist/wavesurfer.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/dist/plugin/wavesurfer.regions.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/oneup.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/app.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/ui.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/engine.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/actions.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      <Script src="/444studio/drag.js" onLoad={handleScriptLoad} strategy="afterInteractive" />
      
      {/* Main Studio Layout */}
      <div className="h-screen bg-black text-white flex overflow-hidden">
        {/* AI Sidebar */}
        <div className={`transition-all duration-300 ${sidebarOpen ? 'w-80' : 'w-0'} bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col overflow-hidden relative z-50`}>
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Sparkles size={20} className="text-purple-400" />
              AI Generation
            </h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1 hover:bg-white/10 rounded transition"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
          
          {/* AI Generation Form */}
          <div className="p-4 border-b border-white/10">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.ctrlKey && aiPrompt.trim().length >= 3) {
                  generateMusic()
                }
              }}
              placeholder="Describe your music... (Ctrl+Enter to generate)"
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
            <div className="flex gap-2 mt-2">
              <select
                value={aiLanguage}
                onChange={(e) => setAiLanguage(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="en">English (MiniMax)</option>
                <option value="es">Spanish (ACE-Step)</option>
                <option value="fr">French (ACE-Step)</option>
                <option value="de">German (ACE-Step)</option>
                <option value="zh">Chinese (ACE-Step)</option>
              </select>
              <button
                onClick={generateMusic}
                disabled={aiPrompt.trim().length < 3}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition disabled:opacity-50 flex items-center gap-2"
              >
                <Zap size={16} />
                Generate
              </button>
            </div>
          </div>
          
          {/* Generations Queue */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">GENERATED TRACKS</h3>
            {generations.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">No generations yet.<br/>Create your first track!</p>
            ) : (
              generations.map(gen => (
                <div
                  key={gen.id}
                  className={`p-3 rounded-lg border transition ${
                    gen.status === 'complete' 
                      ? 'bg-white/5 border-white/10 cursor-pointer hover:bg-white/10' 
                      : 'bg-black/40 border-white/5'
                  }`}
                  onClick={() => {
                    if (gen.status === 'complete' && gen.audioUrl) {
                      loadAudioUrl(gen.audioUrl)
                    }
                  }}
                >
                  <p className="text-sm font-medium truncate">{gen.prompt}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {gen.status === 'queued' && '⏳ Queued...'}
                    {gen.status === 'generating' && '🎵 Generating...'}
                    {gen.status === 'complete' && '✅ Click to load'}
                    {gen.status === 'error' && '❌ Failed'}
                  </p>
                </div>
              ))
            )}
          </div>
          
          {/* Library */}
          <div className="border-t border-white/10 p-4 max-h-64 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-400 mb-2">YOUR LIBRARY</h3>
            {loadingLibrary ? (
              <p className="text-xs text-gray-500">Loading...</p>
            ) : libraryItems.length === 0 ? (
              <p className="text-xs text-gray-500">No tracks yet</p>
            ) : (
              <div className="space-y-1">
                {libraryItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => loadAudioUrl(item.audio_url)}
                    className="p-2 rounded bg-white/5 hover:bg-white/10 cursor-pointer transition text-xs truncate"
                  >
                    {item.title}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Toggle Sidebar Button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 bg-purple-600 hover:bg-purple-500 rounded-r-lg transition z-50"
          >
            <ChevronRight size={16} />
          </button>
        )}
        
        {/* AudioMass Container - Takes Full Remaining Space */}
        <div className="flex-1 flex flex-col bg-black relative">
          {/* Back Button */}
          <div className="absolute top-4 right-4 z-40">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 rounded-lg transition flex items-center gap-2"
            >
              <ChevronLeft size={16} />
              <span className="text-sm">Home</span>
            </button>
          </div>
          
          {!scriptsLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-30">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading 444Studio...</p>
              </div>
            </div>
          )}
          
          {/* AudioMass App Container */}
          <div id="audiomass-container" className="flex-1 w-full h-full"></div>
        </div>
      </div>
      
      {/* AudioMass CSS - Injected inline to avoid conflicts */}
      <link rel="stylesheet" type="text/css" href="/444studio/main.css" />
    </>
  )
}
