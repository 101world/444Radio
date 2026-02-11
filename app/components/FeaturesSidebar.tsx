'use client'

import { Music, Sparkles, Repeat, Image as ImageIcon, Edit3, Rocket, Upload, X, RotateCcw, Mic, Zap, Send, Film, Scissors } from 'lucide-react'

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
  onOpenRelease: () => void
  onClearChat: () => void
  onShowDeletedChats: () => void
  onToggleInstrumental: () => void
  onToggleRecording: () => void
  onSubmitPrompt: () => void
  promptText: string
  onPromptChange: (text: string) => void
  isGenerating: boolean
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
  onOpenRelease,
  onClearChat,
  onShowDeletedChats,
  onToggleInstrumental,
  onToggleRecording,
  onSubmitPrompt,
  promptText,
  onPromptChange,
  isGenerating,
}: FeaturesSidebarProps) {
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
    <div className="hidden md:flex fixed left-20 top-0 h-screen w-96 bg-black/95 backdrop-blur-2xl border-r border-white/10 z-40 flex-col animate-slideInLeft">
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

      {/* Feature Buttons - Vertically Stacked */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
              title="Restore deleted chats"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={onClearChat}
              className="p-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-400/50 transition-all"
              title="Clear chat"
            >
              {/* Trash SVG */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
              </svg>
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
  )
}
