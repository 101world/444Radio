'use client'

import { Music, Sparkles, Repeat, Image as ImageIcon, Edit3, Rocket, Upload, X, RotateCcw, Mic, Zap, Film, Scissors, Lightbulb, ChevronLeft, ChevronDown, Plus, Volume2, Layers, AudioLines, RefreshCw } from 'lucide-react'
import { useState } from 'react'

interface FeaturesSidebarProps {
  isOpen: boolean
  onClose: () => void
  selectedType: string
  isInstrumental: boolean
  isRecording: boolean
  showAdvancedButtons: boolean
  userCredits: number | null
  isLoadingCredits: boolean
  customTitle: string
  genre: string
  customLyrics: string
  bpm: string
  onSelectType: (type: string) => void
  onShowEffects: () => void
  onShowLoopers: () => void
  onShowMusiConGen: () => void
  onShowLyrics: () => void
  onShowUpload: () => void
  onShowVideoToAudio: () => void
  onShowStemSplit: () => void
  onShowAudioBoost: () => void
  onShowExtract: () => void
  onShowAutotune: () => void
  onShowVisualizer: () => void
  onShowLipSync: () => void
  onShowRemix: () => void
  onShowBeatMaker: () => void
  onOpenRelease: () => void
  onClearChat: () => void
  onShowDeletedChats: () => void
  onToggleInstrumental: () => void
  onToggleRecording: () => void
  onSubmitPrompt: () => void
  promptText: string
  onPromptChange: (text: string) => void
  isGenerating: boolean
  // Ideas & Tags
  onTagClick: (tag: string) => void
  onGenerateIdea: (genre: string, type: 'song' | 'beat') => void
  isGeneratingIdea: boolean
}

export default function FeaturesSidebar({
  isOpen,
  onClose,
  selectedType,
  isInstrumental,
  isRecording,
  userCredits,
  isLoadingCredits,
  customTitle,
  genre,
  customLyrics,
  bpm,
  onSelectType,
  onShowEffects,
  onShowLoopers,
  onShowMusiConGen,
  onShowLyrics,
  onShowUpload,
  onShowVideoToAudio,
  onShowStemSplit,
  onShowAudioBoost,
  onShowExtract,
  onShowAutotune,
  onShowVisualizer,
  onShowLipSync,
  onShowRemix,
  onShowBeatMaker,
  onOpenRelease,
  onClearChat,
  onShowDeletedChats,
  onToggleInstrumental,
  onToggleRecording,
  onSubmitPrompt,
  promptText,
  onPromptChange,
  isGenerating,
  onTagClick,
  onGenerateIdea,
  isGeneratingIdea,
}: FeaturesSidebarProps) {
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre' | 'generating'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')
  const [generateOpen, setGenerateOpen] = useState(true)
  const [effectsOpen, setEffectsOpen] = useState(false)

  if (!isOpen) return null

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Sidebar panel */}
      <div className="fixed inset-0 md:inset-auto md:left-14 md:top-0 md:h-screen md:w-64 bg-black/95 backdrop-blur-2xl md:border-r md:border-white/10 z-50 md:z-40 flex flex-col animate-slideInLeft">

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-cyan-400">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span className="text-white font-bold text-sm">Features</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Prompt Input — Prominent */}
        <div className="px-3 py-3 border-b border-white/10 shrink-0">
          <textarea
            value={promptText}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe your music..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
            rows={4}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmitPrompt()
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleRecording}
                className={`p-1.5 rounded-full transition-all ${
                  isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Mic size={13} className={isRecording ? 'text-white' : 'text-gray-400'} />
              </button>
              <button
                onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
                className={`p-1.5 rounded-full transition-all ${
                  showIdeas ? 'bg-yellow-500/20 text-yellow-300' : 'bg-white/10 hover:bg-white/20 text-gray-400 hover:text-yellow-400'
                }`}
                title="Ideas & Tags"
              >
                <Lightbulb size={13} />
              </button>
            </div>
            <button
              onClick={onSubmitPrompt}
              disabled={isGenerating || !promptText.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-lg text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Zap size={11} />
              Generate
            </button>
          </div>
        </div>

        {/* ─── Ideas / Tags Panel ─── */}
        {showIdeas && (
          <div className="px-4 py-4 border-b border-white/10 max-h-[40vh] overflow-y-auto scrollbar-thin">
            {ideasView === 'tags' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                    </svg>
                    <span className="text-sm font-bold text-white">Quick Tags</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIdeasView('type')}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-400/40 rounded-lg text-xs font-bold text-purple-300 hover:text-purple-200 transition-all hover:scale-105 shadow-lg shadow-purple-500/20"
                    >
                      ✨ IDEAS
                    </button>
                    <button onClick={() => setShowIdeas(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'upbeat', 'chill', 'energetic', 'melancholic', 'ambient',
                    'electronic', 'acoustic', 'jazz', 'rock', 'hip-hop',
                    'heavy bass', 'soft piano', 'guitar solo', 'synthwave',
                    'lo-fi beats', 'orchestral', 'dreamy', 'aggressive',
                    'trap', 'drill', 'phonk', 'vaporwave', 'future bass',
                    'drum & bass', 'dubstep', 'house', 'techno', 'trance',
                    'indie', 'folk', 'blues', 'soul', 'funk', 'disco',
                    'reggae', 'latin', 'afrobeat', 'k-pop', 'anime',
                    'cinematic', 'epic', 'dark', 'bright', 'nostalgic',
                    'romantic', 'sad', 'happy', 'mysterious', 'powerful',
                    'soft vocals', 'no vocals', 'female vocals', 'male vocals',
                    'synth lead', 'strings', 'brass', 'flute', 'violin'
                  ].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => onTagClick(tag)}
                      className="px-2.5 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-lg text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </>
            )}

            {ideasView === 'type' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">✨ AI Prompt Ideas</h3>
                  <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center">What would you like to create?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setPromptType('song'); setIdeasView('genre') }}
                    className="group p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border-2 border-purple-400/40 hover:border-purple-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-purple-500/30"
                  >
                    <div className="text-3xl mb-2">🎤</div>
                    <div className="text-sm font-bold text-white mb-1">Song</div>
                    <div className="text-[10px] text-gray-400">With vocals & lyrics</div>
                  </button>
                  <button
                    onClick={() => { setPromptType('beat'); setIdeasView('genre') }}
                    className="group p-5 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border-2 border-cyan-400/40 hover:border-cyan-400/60 rounded-2xl transition-all hover:scale-105 shadow-lg hover:shadow-cyan-500/30"
                  >
                    <div className="text-3xl mb-2">🎹</div>
                    <div className="text-sm font-bold text-white mb-1">Beat</div>
                    <div className="text-[10px] text-gray-400">Instrumental only</div>
                  </button>
                </div>
              </div>
            )}

            {ideasView === 'genre' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setIdeasView('type')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                    <ChevronLeft size={14} /> Back
                  </button>
                  <h3 className="text-sm font-bold text-white">🎵 Select Genre</h3>
                  <button onClick={() => setIdeasView('tags')} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 text-center">Choose a style for your {promptType}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    'electronic', 'hip-hop', 'rock', 'jazz', 'ambient',
                    'trap', 'drill', 'phonk', 'house', 'techno',
                    'lo-fi beats', 'synthwave', 'indie', 'folk', 'blues',
                    'soul', 'funk', 'reggae', 'latin', 'afrobeat',
                    'orchestral', 'cinematic', 'acoustic', 'vaporwave', 'k-pop'
                  ].map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setIdeasView('generating')
                        onGenerateIdea(g, promptType)
                        setTimeout(() => setIdeasView('tags'), 5000)
                      }}
                      disabled={isGeneratingIdea}
                      className="px-2 py-2 bg-cyan-500/10 hover:bg-cyan-500/25 border border-cyan-500/30 hover:border-cyan-400/60 rounded-xl text-xs font-medium text-cyan-200 hover:text-white transition-all hover:scale-105 disabled:opacity-50"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ideasView === 'generating' && (
              <div className="space-y-4 text-center py-6">
                <div className="relative">
                  <div className="w-12 h-12 mx-auto border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl">🎨</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">Creating Amazing Prompt...</h3>
                  <p className="text-xs text-gray-400">AI is crafting the perfect description</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Feature List (Categorized) ─── */}
        <div className="flex-1 overflow-y-auto px-2.5 py-2 scrollbar-thin">

          {/* ▸ Generate Music — Dropdown */}
          <button
            onClick={() => setGenerateOpen(!generateOpen)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white hover:bg-white/5 transition-all"
          >
            <Music size={14} className="text-cyan-400" />
            <span className="flex-1 text-left text-[11px] font-semibold tracking-wide uppercase">Generate Music</span>
            <ChevronDown size={12} className={`text-gray-500 transition-transform duration-200 ${generateOpen ? '' : '-rotate-90'}`} />
          </button>
          {generateOpen && (
            <div className="ml-5 space-y-px mb-1.5">
              <button
                onClick={() => { onSelectType('music'); if (isInstrumental) onToggleInstrumental() }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all ${
                  !isInstrumental && selectedType === 'music'
                    ? 'bg-cyan-500/15 text-cyan-300'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Music size={12} className="shrink-0" />
                <span className="flex-1 text-left">Music</span>
                <span className="text-[9px] text-gray-600">-2</span>
              </button>
              <button
                onClick={() => { onSelectType('music'); if (!isInstrumental) onToggleInstrumental() }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all ${
                  isInstrumental && selectedType === 'music'
                    ? 'bg-purple-500/15 text-purple-300'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="8" x2="8" y1="4" y2="14"/><line x1="16" x2="16" y1="4" y2="14"/><line x1="12" x2="12" y1="4" y2="14"/></svg>
                <span className="flex-1 text-left">Instrumental</span>
                <span className="text-[9px] text-gray-600">-2</span>
              </button>
              <button onClick={onShowBeatMaker} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <AudioLines size={12} className="shrink-0" />
                <span className="flex-1 text-left">Beat Maker</span>
                <span className="text-[9px] text-gray-600">-2</span>
              </button>
              <button onClick={onShowLyrics} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Edit3 size={12} className="shrink-0" />
                <span className="flex-1 text-left">Lyrics</span>
              </button>
              <button onClick={onShowRemix} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Repeat size={12} className="shrink-0" />
                <span className="flex-1 text-left">Remix Audio</span>
                <span className="text-[9px] text-gray-600">-10</span>
              </button>
              <button onClick={onShowLyrics} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <RefreshCw size={12} className="shrink-0" />
                <span className="flex-1 text-left">Remake</span>
              </button>
            </div>
          )}

          {/* ── Individual Features ── */}
          <div className="space-y-px my-1">
            <button onClick={onShowStemSplit} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-purple-500/10 hover:text-purple-300 transition-all">
              <Scissors size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Split Stems</div><div className="text-[9px] text-gray-600 leading-none">Vocals, drums, bass & more</div></div>
            </button>
            <button onClick={onShowVisualizer} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-purple-500/10 hover:text-purple-300 transition-all">
              <Film size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Visualizer</div><div className="text-[9px] text-gray-600 leading-none">Text/Image to video</div></div>
            </button>
            <button onClick={onShowLipSync} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-pink-500/10 hover:text-pink-300 transition-all">
              <Mic size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Lip-Sync</div><div className="text-[9px] text-gray-600 leading-none">Image + Audio to video</div></div>
            </button>
            <button onClick={onShowExtract} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
              <Layers size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Extract</div><div className="text-[9px] text-gray-600 leading-none">Audio from video/audio</div></div>
              <span className="text-[9px] text-gray-600">-1</span>
            </button>
            <button onClick={onOpenRelease} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-300 transition-all">
              <Rocket size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Release</div><div className="text-[9px] text-gray-600 leading-none">Publish to feed</div></div>
            </button>
            <button onClick={onShowAutotune} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-purple-500/10 hover:text-purple-300 transition-all">
              <Mic size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Autotune</div><div className="text-[9px] text-gray-600 leading-none">Pitch correct vocals</div></div>
              <span className="text-[9px] text-gray-600">-1</span>
            </button>
            <button onClick={onShowUpload} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent text-gray-400 hover:bg-purple-500/10 hover:text-purple-300 transition-all">
              <Upload size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Upload</div><div className="text-[9px] text-gray-600 leading-none">Upload audio/video</div></div>
            </button>
            <button
              onClick={() => onSelectType('image')}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all ${
                selectedType === 'image'
                  ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-300'
                  : 'border-transparent text-gray-400 hover:bg-cyan-500/10 hover:text-cyan-300'
              }`}
            >
              <ImageIcon size={13} className="shrink-0" />
              <div className="flex-1 text-left"><div className="text-[11px] font-medium leading-tight">Cover Art</div><div className="text-[9px] text-gray-600 leading-none">AI album artwork</div></div>
              <span className="text-[9px] text-gray-600">-1</span>
            </button>
          </div>

          {/* ▸ Effects — Dropdown */}
          <button
            onClick={() => setEffectsOpen(!effectsOpen)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-white hover:bg-white/5 transition-all"
          >
            <Sparkles size={14} className="text-purple-400" />
            <span className="flex-1 text-left text-[11px] font-semibold tracking-wide uppercase">Effects</span>
            <ChevronDown size={12} className={`text-gray-500 transition-transform duration-200 ${effectsOpen ? '' : '-rotate-90'}`} />
          </button>
          {effectsOpen && (
            <div className="ml-5 space-y-px mb-1.5">
              <button onClick={onShowEffects} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Sparkles size={12} className="shrink-0" />
                <span className="flex-1 text-left">SFX</span>
                <span className="text-[9px] text-gray-600">-2</span>
              </button>
              <button onClick={onShowLoopers} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Repeat size={12} className="shrink-0" />
                <span className="flex-1 text-left">Loops</span>
                <span className="text-[9px] text-gray-600">-6</span>
              </button>
              <button onClick={onShowMusiConGen} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Music size={12} className="shrink-0" />
                <span className="flex-1 text-left">Chords</span>
                <span className="text-[9px] text-gray-600">-4</span>
              </button>
              <button onClick={onShowAudioBoost} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Volume2 size={12} className="shrink-0" />
                <span className="flex-1 text-left">Audio Boost</span>
                <span className="text-[9px] text-gray-600">-1</span>
              </button>
              <button onClick={onShowExtract} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-gray-400 hover:bg-white/5 hover:text-white transition-all">
                <Layers size={12} className="shrink-0" />
                <span className="flex-1 text-left">Extract</span>
                <span className="text-[9px] text-gray-600">-1</span>
              </button>
            </div>
          )}

          {/* Utilities */}
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5">
            <button onClick={onShowDeletedChats} className="p-2 rounded-lg border border-white/10 text-green-400 hover:bg-green-500/10 transition-all" title="Chat History">
              <RotateCcw size={14} />
            </button>
            <button onClick={onClearChat} className="p-2 rounded-lg border border-white/10 text-green-400 hover:bg-green-500/10 transition-all" title="New Chat">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideInLeft {
            from { transform: translateX(-100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .animate-slideInLeft {
            animation: slideInLeft 0.15s ease-out;
          }
        `}</style>
      </div>
    </>
  )
}
