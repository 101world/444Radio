'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Music, Image as ImageIcon, Sparkles, Zap, Loader2, 
  Mic, MicOff, Rocket, Activity, 
  Disc3,
  Layers, Repeat, Film, Scissors, Volume2, Lightbulb, Plus, RotateCcw, Upload, Code
} from 'lucide-react'
import InputEditor from '@/app/components/InputEditor'

const FEATURES = [
  { key: 'input', icon: Code, label: 'INPUT', description: 'Pattern live editor', color: 'green', cost: 0 },
  { key: 'music', icon: Music, label: 'Music', description: 'Generate AI music', color: 'cyan', cost: 2 },
  { key: 'effects', icon: Sparkles, label: 'Effects', description: 'Sound effects', color: 'cyan', cost: 2 },
  { key: 'loops', icon: Repeat, label: 'Loops', description: 'Fixed BPM loops', color: 'cyan', cost: 6 },
  { key: 'chords', icon: Music, label: 'Chords', description: 'Chord & rhythm', color: 'cyan', cost: 4 },
  { key: 'coverart', icon: ImageIcon, label: 'Cover Art', description: 'AI artwork', color: 'cyan', cost: 1 },
  { key: 'video2audio', icon: Film, label: 'Vid→Audio', description: 'Synced SFX', color: 'cyan', cost: 4 },
  { key: 'stems', icon: Scissors, label: 'Stems', description: 'Split vocals/drums', color: 'cyan', cost: 0 },
  { key: 'boost', icon: Volume2, label: 'Boost', description: 'Mix & master', color: 'cyan', cost: 1 },
  { key: 'extract', icon: Layers, label: 'Extract', description: 'Extract audio', color: 'cyan', cost: 1 },
  { key: 'autotune', icon: Mic, label: 'Autotune', description: 'Pitch correct', color: 'cyan', cost: 1 },
  { key: 'visualizer', icon: Film, label: 'Visualizer', description: 'Text→video', color: 'cyan' },
  { key: 'lipsync', icon: Mic, label: 'Lip-Sync', description: 'Image+Audio→video', color: 'cyan' },
  { key: 'upload', icon: Upload, label: 'Upload', description: 'Upload media', color: 'cyan' },
  { key: 'release', icon: Rocket, label: 'Release', description: 'Publish', color: 'cyan' },
]

const QUICK_TAGS = [
  'upbeat', 'chill', 'energetic', 'melancholic', 'ambient',
  'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop',
  'heavy bass', 'soft piano', 'guitar solo', 'synthwave',
  'lo-fi beats', 'orchestral', 'dreamy', 'aggressive',
  'trap', 'drill', 'phonk', 'vaporwave', 'future bass',
  'drum & bass', 'dubstep', 'house', 'techno', 'trance',
]

export default function CreatorV2Page() {
  const router = useRouter()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, size: number, speed: number, color: string}>>([])
  
  const [messages, setMessages] = useState<any[]>([])
  const [credits, setCredits] = useState<number | null>(100)
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationStatus, setGenerationStatus] = useState('')
  
  const [selectedFeature, setSelectedFeature] = useState('input')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<unknown | null>(null)
  const [isInstrumental, setIsInstrumental] = useState(false)
  const [showIdeas, setShowIdeas] = useState(false)
  
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [bpm, setBpm] = useState('')
  const [duration, setDuration] = useState<'short' | 'medium' | 'long'>('long')
  
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState('')
  
  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])
  
  useEffect(() => {
    const newParticles = Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 0.5 + 0.1,
      color: ['#06b6d4', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'][Math.floor(Math.random() * 5)]
    }))
    setParticles(newParticles)
  }, [])
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const startRecording = async () => {
    try {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Speech recognition unavailable')
        return
      }
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) transcript += event.results[i][0].transcript
        }
        if (transcript) setPrompt(prev => prev + (prev ? ' ' : '') + transcript)
      }
      recognition.onend = () => setIsRecording(false)
      recognition.start()
      setMediaRecorder(recognition)
      setIsRecording(true)
    } catch (error) {
      console.error('Recording error:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      try { (mediaRecorder as any).stop() } catch {}
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  const generateMusic = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationStatus('Analyzing prompt...')
    try {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 300))
        setGenerationProgress(i)
        setGenerationStatus(i < 30 ? 'Analyzing...' : i < 60 ? 'Generating...' : i < 90 ? 'Applying FX...' : 'Done')
      }
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'assistant',
        content: `Generated: ${title || 'Untitled'}\nPrompt: ${prompt}\nDuration: ${duration}`,
        timestamp: new Date()
      }])
    } catch (error: any) {
      setGenerationStatus(`Error: ${error.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTagClick = (tag: string) => setPrompt(prev => prev + (prev ? ' ' : '') + tag)
  const handleSubmit = () => { if (selectedFeature === 'music' || selectedFeature === 'effects') generateMusic() }

  return (
    <div className="h-screen bg-black text-white overflow-hidden relative">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-cyan-950/10" />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `linear-gradient(to right, rgba(6,182,212,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(6,182,212,0.2) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }} />
        {particles.map(p => (
          <div key={p.id} className="absolute rounded-full" style={{
            left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size,
            backgroundColor: p.color, boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            animation: `float ${8 / p.speed}s ease-in-out infinite`, opacity: 0.5
          }} />
        ))}
      </div>

      <div className="relative z-10 h-screen flex flex-col">
        {/* Main Content */}
        <main className="flex-1 min-h-0 flex">
          
          {/* Sidebar Toggle */}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`fixed top-1/2 -translate-y-1/2 z-30 p-1.5 bg-white/[0.05] hover:bg-white/[0.1] border-r border-white/[0.1] rounded-r-lg transition-all duration-300 ${isSidebarOpen ? 'left-[320px]' : 'left-0'}`}>
            <Layers className={`w-4 h-4 text-cyan-400/60 transition-transform ${isSidebarOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Sidebar */}
          <div className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white/[0.02] backdrop-blur-2xl border-r border-white/[0.06] flex flex-col relative z-20 overflow-hidden shrink-0`}>
            {isSidebarOpen && (
              <>
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
                  <span className="text-xs font-bold tracking-[0.15em] text-white/40 uppercase">Features</span>
                </div>
                
                {/* Vocal/Inst Toggle */}
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <button onClick={() => setIsInstrumental(false)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${!isInstrumental ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/[0.03] text-white/30 border border-white/[0.06]'}`}>
                      Vocal
                    </button>
                    <button onClick={() => setIsInstrumental(true)}
                      className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isInstrumental ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/[0.03] text-white/30 border border-white/[0.06]'}`}>
                      Inst
                    </button>
                  </div>
                </div>
                
                {/* Ideas */}
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <button onClick={() => setShowIdeas(!showIdeas)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs ${showIdeas ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 'border-white/[0.08] text-white/40 hover:border-yellow-500/20'}`}>
                    <Lightbulb size={14} />
                    <span className="font-semibold">Ideas & Tags</span>
                  </button>
                </div>
                
                {showIdeas && (
                  <div className="px-3 py-2 border-b border-white/[0.06] max-h-36 overflow-y-auto">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_TAGS.map(tag => (
                        <button key={tag} onClick={() => handleTagClick(tag)}
                          className="px-2 py-0.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded text-[10px] text-cyan-300 hover:text-white transition">
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Feature List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                  {FEATURES.map(feature => {
                    const Icon = feature.icon
                    const isActive = selectedFeature === feature.key
                    const colors: Record<string, string> = {
                      cyan: isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-cyan-400/60',
                      purple: isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-cyan-400/60',
                      orange: isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-cyan-400/60',
                      pink: isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-cyan-400/60',
                      green: isActive ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400' : 'border-transparent text-white/35 hover:bg-white/[0.03] hover:text-cyan-400/60',
                    }
                    return (
                      <button key={feature.key} onClick={() => setSelectedFeature(feature.key)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all ${colors[feature.color] || colors.cyan}`}>
                        <Icon size={14} />
                        <div className="flex-1 text-left">
                          <div className="text-xs font-semibold">{feature.label}</div>
                          <div className="text-[9px] text-white/20">{feature.description}</div>
                        </div>
                        {feature.cost !== undefined && (
                          <span className="text-[9px] text-white/15 bg-white/[0.04] px-1.5 py-0.5 rounded">-{feature.cost}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                
                <div className="px-2 py-2 border-t border-white/[0.06]">
                  <div className="flex gap-1.5">
                    <button className="flex-1 p-2 rounded-lg border border-white/[0.06] text-white/25 hover:text-cyan-400/60 hover:border-cyan-500/20 transition flex items-center justify-center gap-1 text-[10px]">
                      <RotateCcw size={11} /> NEW
                    </button>
                    <button className="flex-1 p-2 rounded-lg border border-white/[0.06] text-white/25 hover:text-cyan-400/60 hover:border-cyan-500/20 transition flex items-center justify-center gap-1 text-[10px]">
                      <Plus size={11} /> HISTORY
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Main Panel */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            
            {selectedFeature === 'input' ? (
              <InputEditor />
            ) : (
              <>
                {/* Prompt Area */}
                <div className="p-3 border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shrink-0">
                  <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder={isInstrumental ? "Describe your instrumental..." : "Describe your music..."}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-cyan-500/30 transition"
                    rows={3}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }} />
                  
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={isRecording ? stopRecording : startRecording}
                        className={`p-1.5 rounded-lg transition ${isRecording ? 'bg-red-500/20 text-red-400' : 'bg-white/[0.04] text-white/30 hover:text-white/50'}`}>
                        {isRecording ? <MicOff size={12} /> : <Mic size={12} />}
                      </button>
                      <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title..."
                        className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] text-white/60 placeholder-white/20 focus:outline-none focus:border-cyan-500/30 w-32" />
                      <input type="text" value={bpm} onChange={e => setBpm(e.target.value)} placeholder="BPM"
                        className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] text-white/60 placeholder-white/20 focus:outline-none focus:border-cyan-500/30 w-16 text-center" />
                      <select value={duration} onChange={e => setDuration(e.target.value as any)}
                        className="px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] text-white/60 focus:outline-none cursor-pointer">
                        <option value="short">Short</option>
                        <option value="medium">Med</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                    
                    <button onClick={handleSubmit} disabled={isGenerating || !prompt.trim()}
                      className="flex items-center gap-1.5 px-5 py-1.5 bg-gradient-to-r from-cyan-600/80 to-cyan-400/80 rounded-lg text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition disabled:opacity-20 shadow-lg shadow-cyan-500/20">
                      {isGenerating ? <><Loader2 size={12} className="animate-spin" /> GEN...</> : <><Zap size={12} /> GENERATE</>}
                    </button>
                  </div>
                </div>
              </>
            )}
            
            {/* Progress */}
            {isGenerating && (
              <div className="px-4 py-2 bg-cyan-500/[0.05] border-b border-cyan-500/20 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  <span className="font-mono text-[11px] text-cyan-400/70">{generationStatus}</span>
                </div>
                <div className="w-full bg-white/[0.04] rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-200 transition-all duration-300" style={{ width: `${generationProgress}%` }} />
                </div>
              </div>
            )}
            
            {/* Messages */}
            {selectedFeature !== 'input' && (
              <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Activity size={40} className="text-cyan-500/20 mb-3" />
                    <p className="text-sm font-bold text-cyan-400/40">READY</p>
                    <p className="text-[11px] text-white/15">Select a feature and enter your prompt</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3 py-2 rounded-xl backdrop-blur-xl ${
                          msg.role === 'user'
                            ? 'bg-cyan-500/10 border border-cyan-400/20 text-cyan-200/70'
                            : 'bg-cyan-500/[0.06] border border-cyan-500/15 text-cyan-200/70'
                        }`}>
                          <div className="whitespace-pre-wrap text-xs">{msg.content}</div>
                          <p className="text-[9px] opacity-30 mt-1">{msg.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
            )}
            
            {/* No footer — clean edge-to-edge */}
          </div>
        </main>
      </div>
      
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}</style>
    </div>
  )
}
