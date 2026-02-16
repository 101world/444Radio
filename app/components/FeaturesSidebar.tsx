'use client'

import { Music, Sparkles, Repeat, Image as ImageIcon, Edit3, Rocket, Upload, X, RotateCcw, Mic, Zap, Send, Film, Scissors, Lightbulb, ChevronLeft, Plus, Volume2, Layers } from 'lucide-react'
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
  onShowLyrics: () => void
  onShowUpload: () => void
  onShowVideoToAudio: () => void
  onShowStemSplit: () => void
  onShowAudioBoost: () => void
  onShowExtract: () => void
  onShowAutotune: () => void
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
  onShowLyrics,
  onShowUpload,
  onShowVideoToAudio,
  onShowStemSplit,
  onShowAudioBoost,
  onShowExtract,
  onShowAutotune,
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

  if (!isOpen) return null

  const features = [
    {
      icon: Music,
      label: 'Music',
      description: 'Generate AI music',
      color: 'cyan',
      active: selectedType === 'music',
      cost: 2,
      onClick: () => onSelectType('music'),
    },
    {
      icon: Sparkles,
      label: 'Effects',
      description: 'Sound effects',
      color: 'purple',
      active: false,
      cost: 2,
      onClick: onShowEffects,
    },
    {
      icon: Repeat,
      label: 'Loops',
      description: 'Fixed BPM loops',
      color: 'cyan',
      active: false,
      cost: 2,
      onClick: onShowLoopers,
    },
    {
      icon: ImageIcon,
      label: 'Cover Art',
      description: 'AI album artwork',
      color: 'cyan',
      active: selectedType === 'image',
      cost: 1,
      onClick: () => onSelectType('image'),
    },
    {
      icon: Film,
      label: 'Video to Audio',
      description: 'Synced SFX from video',
      color: 'cyan',
      active: false,
      cost: 2,
      onClick: onShowVideoToAudio,
    },
    {
      icon: Scissors,
      label: 'Split Stems',
      description: 'Vocals, drums, bass & more',
      color: 'purple',
      active: false,
      cost: 5,
      onClick: onShowStemSplit,
    },
    {
      icon: Volume2,
      label: 'Audio Boost',
      description: 'Mix & master your track',
      color: 'orange',
      active: false,
      cost: 1,
      onClick: onShowAudioBoost,
    },
    {
      icon: Layers,
      label: 'Extract',
      description: 'Extract audio from video/audio',
      color: 'cyan',
      active: false,
      cost: 1,
      onClick: onShowExtract,
    },
    {
      icon: Mic,
      label: 'Autotune',
      description: 'Pitch correct vocals',
      color: 'purple',
      active: false,
      cost: 1,
      onClick: onShowAutotune,
    },
    {
      icon: Edit3,
      label: 'Lyrics',
      description: 'Write & edit lyrics',
      color: 'cyan',
      active: !!(customTitle || genre || customLyrics || bpm),
      onClick: onShowLyrics,
      hidden: selectedType !== 'music' || isInstrumental,
    },
    {
      icon: Upload,
      label: 'Upload',
      description: 'Upload audio/video',
      color: 'purple',
      active: false,
      onClick: onShowUpload,
    },
    {
      icon: Rocket,
      label: 'Release',
      description: 'Publish to feed',
      color: 'cyan',
      active: false,
      onClick: onOpenRelease,
    },
  ]

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Sidebar panel — fullscreen on mobile, docked sidebar on desktop */}
      <div className="fixed inset-0 md:inset-auto md:left-20 md:top-0 md:h-screen md:w-96 bg-black/95 backdrop-blur-2xl md:border-r md:border-white/10 z-50 md:z-40 flex flex-col animate-slideInLeft">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-20 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* Features SVG Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-cyan-400">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2"/>
          </svg>
          <span className="text-white font-bold text-lg">Features</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X size={18} className="text-gray-400" />
        </button>
      </div>

      {/* Credits */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
          <Zap size={16} className="text-cyan-400" />
          <span className="text-white font-bold text-sm">
            {isLoadingCredits ? '...' : userCredits} credits
          </span>
        </div>
      </div>

      {/* Mode Toggle - SVG Icons */}
      <div className="px-5 py-3 border-b border-white/10">
        <div className="flex gap-2">
          <button
            onClick={onToggleInstrumental}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              !isInstrumental
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
            title="Vocal Mode"
          >
            {/* Microphone SVG */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
            Vocal
          </button>
          <button
            onClick={onToggleInstrumental}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              isInstrumental
                ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
            }`}
            title="Instrumental Mode"
          >
            {/* Piano/Keys SVG */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="8" x2="8" y1="4" y2="14"/>
              <line x1="16" x2="16" y1="4" y2="14"/>
              <line x1="12" x2="12" y1="4" y2="14"/>
            </svg>
            Inst
          </button>
        </div>
      </div>

      {/* Prompt Input in Sidebar */}
      <div className="px-5 py-4 border-b border-white/10">
        <div className="relative">
          <textarea
            value={promptText}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe your music..."
            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
            rows={5}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSubmitPrompt()
              }
            }}
          />
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={onToggleRecording}
              className={`p-2 rounded-full transition-all ${
                isRecording
                  ? 'bg-red-500 animate-pulse'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              <Mic size={14} className={isRecording ? 'text-white' : 'text-gray-400'} />
            </button>
            <button
              onClick={onSubmitPrompt}
              disabled={isGenerating || !promptText.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-xl text-black text-xs font-bold hover:from-cyan-500 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send size={12} />
              Generate
            </button>
          </div>
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

      {/* Feature Buttons - Vertically Stacked */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Ideas Lightbulb Button */}
        <button
          onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group mb-3 ${
            showIdeas
              ? 'bg-gradient-to-r from-yellow-600/30 to-amber-400/20 border-yellow-400 text-yellow-300'
              : 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-400/50'
          }`}
        >
          <div className={`p-2 rounded-lg ${showIdeas ? 'bg-white/10' : 'bg-white/5'}`}>
            <Lightbulb size={18} />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-semibold">Ideas & Tags</div>
            <div className="text-[10px] text-gray-500">AI prompts & quick tags</div>
          </div>
          <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">AI</span>
        </button>

        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-3 px-1">Creation Tools</p>
        <div className="space-y-2">
          {features.filter(f => !f.hidden).map((feature) => {
            const Icon = feature.icon
            const colorMap: Record<string, string> = {
              cyan: feature.active
                ? 'bg-gradient-to-r from-cyan-600/30 to-cyan-400/20 border-cyan-400 text-cyan-300'
                : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400/50',
              purple: feature.active
                ? 'bg-gradient-to-r from-purple-600/30 to-pink-500/20 border-purple-400 text-purple-300'
                : 'border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400/50',
              orange: feature.active
                ? 'bg-gradient-to-r from-orange-600/30 to-red-500/20 border-orange-400 text-orange-300'
                : 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-400/50',
            }

            return (
              <button
                key={feature.label}
                onClick={feature.onClick}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group ${colorMap[feature.color]}`}
              >
                <div className={`p-2 rounded-lg ${feature.active ? 'bg-white/10' : 'bg-white/5'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold">{feature.label}</div>
                  <div className="text-[10px] text-gray-500">{feature.description}</div>
                </div>
                {feature.cost && (
                  <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-1 rounded-full">
                    -{feature.cost}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Utilities Section - Icon Only */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 px-1">
            <button
              onClick={onShowDeletedChats}
              className="p-2.5 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-400/50 transition-all"
              title="Chat History"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClearChat}
              className="p-2.5 rounded-xl border border-green-500/30 text-green-400 hover:bg-green-500/10 hover:border-green-400/50 transition-all"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slideInLeft {
          animation: slideInLeft 0.3s ease-out;
        }
      `}</style>
    </div>
    </>
  )
}
