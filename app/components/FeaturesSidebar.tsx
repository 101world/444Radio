'use client'

import { Music, Sparkles, Repeat, Image as ImageIcon, Edit3, Rocket, Upload, X, Mic, Zap, Film, Scissors, Lightbulb, ChevronLeft, Volume2, Layers, AudioLines, RefreshCw, AudioWaveform, Wand2, Replace, Headphones, MicVocal, Crown, HelpCircle } from 'lucide-react'
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
  onShowProExtend: () => void
  onShowProInpaint: () => void
  onShowProCover: () => void
  onShowProAddVocals: () => void
  onShowProVoiceToMelody: () => void
  onClearChat: () => void
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
  isProMode?: boolean
}

// ─── Tile data type ──────────────────────────────────────────
type Tile = {
  icon: any
  label: string
  desc: string
  gradient: string
  glowColor: string
  activeGradient: string
  active: boolean
  cost?: number
  onClick: () => void
  hidden?: boolean
  size?: 'normal' | 'wide'
  helpText?: string
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
  onShowProExtend,
  onShowProInpaint,
  onShowProCover,
  onShowProAddVocals,
  onShowProVoiceToMelody,
  onClearChat,
  onToggleInstrumental,
  onToggleRecording,
  onSubmitPrompt,
  promptText,
  onPromptChange,
  isGenerating,
  onTagClick,
  onGenerateIdea,
  isGeneratingIdea,
  isProMode = false,
}: FeaturesSidebarProps) {
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideasView, setIdeasView] = useState<'tags' | 'type' | 'genre' | 'generating'>('tags')
  const [promptType, setPromptType] = useState<'song' | 'beat'>('song')
  const [activeSection, setActiveSection] = useState<'create' | 'pro' | 'fx' | 'process' | 'publish'>('create')

  if (!isOpen) return null

  // ═══ TILE DEFINITIONS — vibrant gradients + descriptions ═══
  const proGradient = (base: string) => isProMode
    ? 'from-red-500/30 via-red-600/15 to-red-900/25'
    : base
  const proGlow = (base: string) => isProMode ? 'shadow-red-500/30' : base
  const proActiveGrad = (base: string) => isProMode
    ? 'from-red-500/45 via-red-600/30 to-red-900/40 ring-red-400/70'
    : base

  const sections: Record<string, { label: string; emoji: string; tiles: Tile[] }> = {
    create: {
      label: 'Create',
      emoji: '🎵',
      tiles: [
        {
          icon: Music, label: 'Music', desc: 'AI song generation',
          gradient: proGradient('from-cyan-400/35 via-blue-500/25 to-indigo-500/30'),
          glowColor: proGlow('shadow-cyan-400/30'),
          activeGradient: proActiveGrad('from-cyan-400/50 via-blue-500/40 to-indigo-500/45 ring-cyan-400/70'),
          active: selectedType === 'music' && !isInstrumental, cost: 2,
          onClick: () => { onSelectType('music'); if (isInstrumental) onToggleInstrumental() },
        },
        {
          icon: AudioLines, label: 'Beats', desc: 'AI drums & samples',
          gradient: proGradient('from-violet-400/35 via-purple-500/25 to-fuchsia-500/30'),
          glowColor: proGlow('shadow-violet-400/30'),
          activeGradient: proActiveGrad('from-violet-400/50 via-purple-500/40 to-fuchsia-500/45 ring-violet-400/70'),
          active: false, cost: 2,
          onClick: onShowBeatMaker,
        },
        {
          icon: Music, label: 'Inst.', desc: 'No vocals, pure sound',
          gradient: proGradient('from-purple-400/35 via-indigo-400/25 to-blue-500/30'),
          glowColor: proGlow('shadow-purple-400/30'),
          activeGradient: proActiveGrad('from-purple-400/50 via-indigo-400/40 to-blue-500/45 ring-purple-400/70'),
          active: selectedType === 'music' && isInstrumental, cost: 2,
          onClick: () => { onSelectType('music'); if (!isInstrumental) onToggleInstrumental() },
        },
        {
          icon: ImageIcon, label: 'Art', desc: 'AI album artwork',
          gradient: proGradient('from-pink-400/35 via-rose-500/25 to-orange-400/30'),
          glowColor: proGlow('shadow-pink-400/30'),
          activeGradient: proActiveGrad('from-pink-400/50 via-rose-500/40 to-orange-400/45 ring-pink-400/70'),
          active: selectedType === 'image', cost: 1,
          onClick: () => onSelectType('image'),
        },
        {
          icon: Repeat, label: 'Remix', desc: 'Audio-to-audio remix',
          gradient: proGradient('from-amber-400/35 via-orange-500/25 to-red-400/30'),
          glowColor: proGlow('shadow-amber-400/30'),
          activeGradient: proActiveGrad('from-amber-400/50 via-orange-500/40 to-red-400/45 ring-amber-400/70'),
          active: false, cost: 10,
          onClick: onShowRemix,
        },
        {
          icon: Edit3, label: 'Lyrics', desc: 'Write & edit words',
          gradient: proGradient('from-emerald-400/35 via-teal-500/25 to-cyan-500/30'),
          glowColor: proGlow('shadow-emerald-400/30'),
          activeGradient: proActiveGrad('from-emerald-400/50 via-teal-500/40 to-cyan-500/45 ring-emerald-400/70'),
          active: !!(customTitle || genre || customLyrics || bpm),
          onClick: onShowLyrics,
          hidden: selectedType !== 'music' || isInstrumental,
        },
        {
          icon: RefreshCw, label: 'Remake', desc: 'Reimagine tracks',
          gradient: proGradient('from-sky-400/35 via-blue-400/25 to-indigo-400/30'),
          glowColor: proGlow('shadow-sky-400/30'),
          activeGradient: proActiveGrad('from-sky-400/50 via-blue-400/40 to-indigo-400/45 ring-sky-400/70'),
          active: false,
          onClick: onShowLyrics,
        },
      ],
    },
    fx: {
      label: 'Effects',
      emoji: '✨',
      tiles: [
        {
          icon: Sparkles, label: 'SFX', desc: 'Sound effects',
          gradient: proGradient('from-fuchsia-400/35 via-pink-500/25 to-purple-500/30'),
          glowColor: proGlow('shadow-fuchsia-400/30'),
          activeGradient: proActiveGrad('from-fuchsia-400/50 via-pink-500/40 to-purple-500/45 ring-fuchsia-400/70'),
          active: false, cost: 2,
          onClick: onShowEffects,
        },
        {
          icon: Repeat, label: 'Loops', desc: 'Fixed BPM loops',
          gradient: proGradient('from-cyan-400/35 via-teal-400/25 to-emerald-500/30'),
          glowColor: proGlow('shadow-cyan-400/30'),
          activeGradient: proActiveGrad('from-cyan-400/50 via-teal-400/40 to-emerald-500/45 ring-cyan-400/70'),
          active: false, cost: 6,
          onClick: onShowLoopers,
        },
        {
          icon: Music, label: 'Chords', desc: 'Chord & rhythm control',
          gradient: proGradient('from-violet-400/35 via-indigo-400/25 to-blue-500/30'),
          glowColor: proGlow('shadow-violet-400/30'),
          activeGradient: proActiveGrad('from-violet-400/50 via-indigo-400/40 to-blue-500/45 ring-violet-400/70'),
          active: false, cost: 4,
          onClick: onShowMusiConGen,
        },
        {
          icon: Volume2, label: 'Boost', desc: 'Mix & master audio',
          gradient: proGradient('from-amber-400/35 via-yellow-400/25 to-orange-400/30'),
          glowColor: proGlow('shadow-amber-400/30'),
          activeGradient: proActiveGrad('from-amber-400/50 via-yellow-400/40 to-orange-400/45 ring-amber-400/70'),
          active: false, cost: 1,
          onClick: onShowAudioBoost,
        },
      ],
    },
    process: {
      label: 'Process',
      emoji: '🔧',
      tiles: [
        {
          icon: Scissors, label: 'Stems', desc: 'Vocals, drums, bass',
          gradient: proGradient('from-teal-400/35 via-emerald-400/25 to-green-500/30'),
          glowColor: proGlow('shadow-teal-400/30'),
          activeGradient: proActiveGrad('from-teal-400/50 via-emerald-400/40 to-green-500/45 ring-teal-400/70'),
          active: false, cost: 0,
          onClick: onShowStemSplit,
        },
        {
          icon: Layers, label: 'Extract', desc: 'Pull audio from media',
          gradient: proGradient('from-blue-400/35 via-sky-400/25 to-cyan-500/30'),
          glowColor: proGlow('shadow-blue-400/30'),
          activeGradient: proActiveGrad('from-blue-400/50 via-sky-400/40 to-cyan-500/45 ring-blue-400/70'),
          active: false, cost: 1,
          onClick: onShowExtract,
        },
        {
          icon: Mic, label: 'Tune', desc: 'Pitch correct vocals',
          gradient: proGradient('from-rose-400/35 via-pink-400/25 to-fuchsia-500/30'),
          glowColor: proGlow('shadow-rose-400/30'),
          activeGradient: proActiveGrad('from-rose-400/50 via-pink-400/40 to-fuchsia-500/45 ring-rose-400/70'),
          active: false, cost: 1,
          onClick: onShowAutotune,
        },
        {
          icon: Film, label: 'Visual', desc: 'Text/Image to video',
          gradient: proGradient('from-indigo-400/35 via-violet-400/25 to-purple-500/30'),
          glowColor: proGlow('shadow-indigo-400/30'),
          activeGradient: proActiveGrad('from-indigo-400/50 via-violet-400/40 to-purple-500/45 ring-indigo-400/70'),
          active: false,
          onClick: onShowVisualizer,
        },
        {
          icon: Mic, label: 'Lip Sync', desc: 'Image + audio to video',
          gradient: proGradient('from-pink-400/35 via-rose-400/25 to-red-400/30'),
          glowColor: proGlow('shadow-pink-400/30'),
          activeGradient: proActiveGrad('from-pink-400/50 via-rose-400/40 to-red-400/45 ring-pink-400/70'),
          active: false,
          onClick: onShowLipSync,
        },
        {
          icon: Film, label: 'Vid→Aud', desc: 'Synced SFX from video',
          gradient: proGradient('from-orange-400/35 via-amber-400/25 to-yellow-500/30'),
          glowColor: proGlow('shadow-orange-400/30'),
          activeGradient: proActiveGrad('from-orange-400/50 via-amber-400/40 to-yellow-500/45 ring-orange-400/70'),
          active: false, cost: 4,
          onClick: onShowVideoToAudio,
        },
      ],
    },
    publish: {
      label: 'Publish',
      emoji: '🚀',
      tiles: [
        {
          icon: Upload, label: 'Upload', desc: 'Upload audio & video',
          gradient: proGradient('from-emerald-400/35 via-green-400/25 to-teal-500/30'),
          glowColor: proGlow('shadow-emerald-400/30'),
          activeGradient: proActiveGrad('from-emerald-400/50 via-green-400/40 to-teal-500/45 ring-emerald-400/70'),
          active: false,
          onClick: onShowUpload, size: 'wide',
        },
        {
          icon: Rocket, label: 'Release', desc: 'Publish to feed',
          gradient: proGradient('from-cyan-400/35 via-blue-400/25 to-violet-500/30'),
          glowColor: proGlow('shadow-cyan-400/30'),
          activeGradient: proActiveGrad('from-cyan-400/50 via-blue-400/40 to-violet-500/45 ring-cyan-400/70'),
          active: false,
          onClick: onOpenRelease, size: 'wide',
        },
      ],
    },
  }

  // ═══ ADVANCED section — always available (Pro & Standard) ═══
  sections.pro = {
    label: '444 Advanced',
    emoji: '⚡',
    tiles: [
      {
        icon: Wand2, label: 'Extend', desc: 'Continue a track from any point',
        gradient: proGradient('from-violet-500/35 via-purple-500/25 to-fuchsia-500/30'),
        glowColor: proGlow('shadow-violet-400/30'),
        activeGradient: proActiveGrad('from-violet-500/50 via-purple-500/40 to-fuchsia-500/45 ring-violet-400/70'),
        active: false, cost: 4,
        onClick: onShowProExtend,
        helpText: 'Upload audio or paste a URL. Choose to extend from the end (right) or add a new intro (left). 4 credits.',
      },
      {
        icon: Replace, label: 'Inpaint', desc: 'Replace a section in a track',
        gradient: proGradient('from-rose-500/35 via-pink-500/25 to-fuchsia-500/30'),
        glowColor: proGlow('shadow-rose-400/30'),
        activeGradient: proActiveGrad('from-rose-500/50 via-pink-500/40 to-fuchsia-500/45 ring-rose-400/70'),
        active: false, cost: 4,
        onClick: onShowProInpaint,
        helpText: 'Upload audio and set start/end times for the section to replace. Add style tags. 4 credits.',
      },
      {
        icon: RefreshCw, label: 'Cover', desc: 'Re-create in a new style',
        gradient: proGradient('from-blue-500/35 via-indigo-500/25 to-violet-500/30'),
        glowColor: proGlow('shadow-blue-400/30'),
        activeGradient: proActiveGrad('from-blue-500/50 via-indigo-500/40 to-violet-500/45 ring-blue-400/70'),
        active: false, cost: 22,
        onClick: onShowProCover,
        helpText: 'Upload any audio file or paste a URL. The AI will re-create it in a completely different style.',
      },
      {
        icon: MicVocal, label: 'Add Vocals', desc: 'AI vocals on instrumental',
        gradient: proGradient('from-pink-500/35 via-rose-500/25 to-red-500/30'),
        glowColor: proGlow('shadow-pink-400/30'),
        activeGradient: proActiveGrad('from-pink-500/50 via-rose-500/40 to-red-500/45 ring-pink-400/70'),
        active: false, cost: 22,
        onClick: onShowProAddVocals,
        helpText: 'Upload an instrumental track. The AI generates lyrics/vocals and layers them on top.',
      },
      {
        icon: Headphones, label: 'Melody→Song', desc: 'Hum/sing → full track',
        gradient: proGradient('from-orange-500/35 via-amber-500/25 to-yellow-500/30'),
        glowColor: proGlow('shadow-orange-400/30'),
        activeGradient: proActiveGrad('from-orange-500/50 via-amber-500/40 to-yellow-500/45 ring-orange-400/70'),
        active: false, cost: 22,
        onClick: onShowProVoiceToMelody,
        helpText: 'Upload a vocal recording or hum. The AI creates full instrumental backing to match your melody.',
      },
    ],
  }

  const sectionKeys: ('create' | 'pro' | 'fx' | 'process' | 'publish')[] = ['create', 'pro', 'fx', 'process', 'publish']
  const currentSection = sections[activeSection] || sections.create
  const visibleTiles = currentSection.tiles.filter(t => !t.hidden)

  const tabIcons: Record<string, { icon: any; label: string }> = {
    create: { icon: Music, label: 'Create' },
    pro: { icon: Crown, label: 'Advanced' },
    fx: { icon: Sparkles, label: 'FX' },
    process: { icon: Scissors, label: 'Process' },
    publish: { icon: Rocket, label: 'Publish' },
  }

  return (
    <>
      {/* Mobile backdrop */}
      <div className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-md z-50" onClick={onClose} />

      {/* ═══ Sidebar Panel ═══ */}
      <div className={`fixed inset-0 md:inset-auto md:left-14 md:top-0 md:h-screen md:w-72 z-50 md:z-40 flex flex-col animate-slideInLeft overflow-hidden ${
        isProMode
          ? 'bg-gradient-to-b from-[#0d0608] via-[#0a0506] to-[#080404] md:border-r md:border-red-500/15'
          : 'bg-gradient-to-b from-[#080c14] via-[#060a12] to-[#040810] md:border-r md:border-white/[0.08]'
      }`}>

        {/* ── Frosted header ── */}
        <div className={`flex items-center justify-between px-4 h-14 shrink-0 backdrop-blur-xl ${
          isProMode ? 'bg-red-500/5 border-b border-red-500/10' : 'bg-white/[0.02] border-b border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isProMode
                ? 'bg-gradient-to-br from-red-500/30 to-red-600/20 shadow-lg shadow-red-500/20'
                : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/20 shadow-lg shadow-cyan-500/20'
            }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={isProMode ? 'text-red-400' : 'text-cyan-400'}>
                <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2"/>
                <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <span className="text-white/90 font-semibold text-sm tracking-tight">Features</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Credits pill */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
              isProMode
                ? 'bg-red-500/15 text-red-300 border border-red-500/20'
                : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
            }`}>
              <Zap size={10} />
              {isLoadingCredits ? '…' : userCredits}
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/[0.08] transition-colors">
              <X size={14} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* ── Section tabs (pill nav) ── */}
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className={`flex gap-1 p-1 rounded-2xl ${
            isProMode ? 'bg-red-500/[0.06]' : 'bg-white/[0.03]'
          }`}>
            {sectionKeys.map(key => {
              const tab = tabIcons[key]
              const Icon = tab.icon
              const isActive = activeSection === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-semibold transition-all duration-200 ${
                    isActive
                      ? isProMode
                        ? 'bg-red-500/20 text-red-300 shadow-sm shadow-red-500/10'
                        : 'bg-white/[0.1] text-white shadow-sm shadow-white/5'
                      : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={12} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Prompt input (compact, elegant) ── */}
        <div className="px-3 py-2 shrink-0">
          <div className={`rounded-2xl p-0.5 ${
            isProMode
              ? 'bg-gradient-to-r from-red-500/20 via-red-600/10 to-red-500/20'
              : 'bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-purple-500/20'
          }`}>
            <div className="bg-[#0a0c14]/90 rounded-[14px] p-2.5">
              <textarea
                value={promptText}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Describe your sound…"
                className="w-full bg-transparent text-xs text-white/90 placeholder-white/20 resize-none focus:outline-none leading-relaxed"
                rows={2}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmitPrompt() } }}
              />
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleRecording}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isRecording
                        ? 'bg-red-500 shadow-lg shadow-red-500/40 animate-pulse'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/30 hover:text-white/50'
                    }`}
                  >
                    <Mic size={12} className={isRecording ? 'text-white' : ''} />
                  </button>
                  <button
                    onClick={() => { setShowIdeas(!showIdeas); setIdeasView('tags') }}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      showIdeas
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/30 hover:text-amber-400'
                    }`}
                  >
                    <Lightbulb size={12} />
                  </button>
                </div>
                <button
                  onClick={onSubmitPrompt}
                  disabled={isGenerating || !promptText.trim()}
                  className={`flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:opacity-25 disabled:cursor-not-allowed ${
                    isProMode
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-500/30 hover:shadow-red-500/50'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50'
                  }`}
                >
                  <Zap size={10} />
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Ideas / Tags Panel ─── */}
        {showIdeas && (
          <div className={`px-3 pb-2 max-h-[35vh] overflow-y-auto scrollbar-thin shrink-0 ${
            isProMode ? 'border-b border-red-500/10' : 'border-b border-white/[0.06]'
          }`}>
            {ideasView === 'tags' && (
              <div className="pb-3">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Lightbulb size={13} className="text-amber-400" />
                    <span className="text-xs font-semibold text-white/70">Quick Tags</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIdeasView('type')}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        isProMode
                          ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/20'
                          : 'bg-gradient-to-r from-purple-500/15 to-pink-500/15 text-purple-300 hover:text-purple-200 border border-purple-500/20'
                      }`}
                    >
                      ✨ IDEAS
                    </button>
                    <button onClick={() => setShowIdeas(false)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/[0.08]">
                      <X size={12} className="text-white/30" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
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
                      className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-[1.04] ${
                        isProMode
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-200/70 hover:text-white border border-red-500/15 hover:border-red-400/40'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.15]'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ideasView === 'type' && (
              <div className="space-y-3 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white/80">✨ AI Ideas</h3>
                  <button onClick={() => setIdeasView('tags')} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/[0.08]">
                    <X size={12} className="text-white/30" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setPromptType('song'); setIdeasView('genre') }}
                    className={`group p-4 rounded-2xl border transition-all hover:scale-[1.03] ${
                      isProMode
                        ? 'bg-gradient-to-br from-red-500/15 to-red-800/15 border-red-500/20 hover:border-red-400/40 shadow-lg shadow-red-500/10'
                        : 'bg-gradient-to-br from-purple-500/15 to-pink-500/15 border-purple-500/20 hover:border-purple-400/40 shadow-lg shadow-purple-500/10'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">🎤</div>
                    <div className="text-xs font-bold text-white/90">Song</div>
                    <div className="text-[9px] text-white/30">Vocals + lyrics</div>
                  </button>
                  <button
                    onClick={() => { setPromptType('beat'); setIdeasView('genre') }}
                    className={`group p-4 rounded-2xl border transition-all hover:scale-[1.03] ${
                      isProMode
                        ? 'bg-gradient-to-br from-red-600/15 to-red-900/15 border-red-500/20 hover:border-red-400/40 shadow-lg shadow-red-600/10'
                        : 'bg-gradient-to-br from-cyan-500/15 to-blue-500/15 border-cyan-500/20 hover:border-cyan-400/40 shadow-lg shadow-cyan-500/10'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">🎹</div>
                    <div className="text-xs font-bold text-white/90">Beat</div>
                    <div className="text-[9px] text-white/30">Instrumental</div>
                  </button>
                </div>
              </div>
            )}

            {ideasView === 'genre' && (
              <div className="space-y-2.5 pb-3">
                <div className="flex items-center justify-between">
                  <button onClick={() => setIdeasView('type')} className={`text-[10px] hover:opacity-80 flex items-center gap-1 ${isProMode ? 'text-red-400' : 'text-cyan-400'}`}>
                    <ChevronLeft size={12} /> Back
                  </button>
                  <span className="text-xs font-bold text-white/70">Select Genre</span>
                  <button onClick={() => setIdeasView('tags')} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/[0.08]">
                    <X size={12} className="text-white/30" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    'electronic', 'hip-hop', 'rock', 'jazz', 'ambient',
                    'trap', 'drill', 'phonk', 'house', 'techno',
                    'lo-fi beats', 'synthwave', 'indie', 'folk', 'blues',
                    'soul', 'funk', 'reggae', 'latin', 'afrobeat',
                    'orchestral', 'cinematic', 'acoustic', 'vaporwave', 'k-pop'
                  ].map((g) => (
                    <button
                      key={g}
                      onClick={() => { setIdeasView('generating'); onGenerateIdea(g, promptType); setTimeout(() => setIdeasView('tags'), 5000) }}
                      disabled={isGeneratingIdea}
                      className={`px-1.5 py-1.5 rounded-xl text-[10px] font-medium transition-all hover:scale-[1.04] disabled:opacity-40 border ${
                        isProMode
                          ? 'bg-red-500/10 hover:bg-red-500/20 border-red-500/15 text-red-200/70 hover:text-white'
                          : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.06] text-white/40 hover:text-white/70'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {ideasView === 'generating' && (
              <div className="space-y-3 text-center py-5">
                <div className="relative">
                  <div className={`w-10 h-10 mx-auto border-[3px] rounded-full animate-spin ${isProMode ? 'border-red-500/20 border-t-red-400' : 'border-cyan-500/20 border-t-cyan-400'}`} />
                  <div className="absolute inset-0 flex items-center justify-center"><span className="text-lg">🎨</span></div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white/60">Crafting prompt…</p>
                  <p className="text-[10px] text-white/25 mt-0.5">AI is thinking</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ TILE GRID ═══ */}
        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          {/* Section header */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-sm">{currentSection.emoji}</span>
            <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">{currentSection.label}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
          </div>

          {/* Tiles grid */}
          <div className="grid grid-cols-2 gap-2">
            {visibleTiles.map((tile, idx) => {
              const Icon = tile.icon
              return (
                <button
                  key={`${activeSection}-${idx}`}
                  onClick={tile.onClick}
                  className={`group relative rounded-2xl p-3.5 border backdrop-blur-sm transition-all duration-200 hover:scale-[1.03] active:scale-[0.98] overflow-hidden ${
                    tile.size === 'wide' ? 'col-span-2' : ''
                  } ${
                    tile.active
                      ? `bg-gradient-to-br ${tile.activeGradient} ring-1 shadow-lg ${tile.glowColor}`
                      : `bg-gradient-to-br ${tile.gradient} border-white/[0.06] hover:border-white/[0.12] shadow-md ${tile.glowColor} hover:shadow-lg`
                  }`}
                >
                  {/* Ambient glow dot */}
                  <div className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full transition-all ${
                    tile.active ? 'bg-white/60 shadow-sm shadow-white/40' : 'bg-white/10 group-hover:bg-white/20'
                  }`} />

                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-all ${
                    tile.active
                      ? 'bg-white/20 shadow-inner shadow-white/10'
                      : 'bg-white/[0.08] group-hover:bg-white/[0.14]'
                  }`}>
                    <Icon size={18} className={`transition-all ${
                      tile.active ? 'text-white drop-shadow-sm' : 'text-white/60 group-hover:text-white/80'
                    }`} />
                  </div>

                  {/* Label */}
                  <div className={`text-[11px] font-semibold transition-colors leading-tight ${
                    tile.active ? 'text-white' : 'text-white/70 group-hover:text-white/90'
                  }`}>
                    {tile.label}
                  </div>

                  {/* Description */}
                  <div className={`text-[9px] mt-0.5 leading-tight transition-colors ${
                    tile.active ? 'text-white/50' : 'text-white/25 group-hover:text-white/40'
                  }`}>
                    {tile.desc}
                  </div>

                  {/* Help tooltip */}
                  {tile.helpText && (
                    <div className="absolute top-2 left-2 group/help">
                      <HelpCircle size={11} className="text-white/15 group-hover/help:text-white/50 transition-colors cursor-help" />
                      <div className="hidden group-hover/help:block absolute left-0 top-5 z-50 w-48 p-2 rounded-lg bg-black/95 border border-white/10 shadow-xl">
                        <p className="text-[10px] text-white/70 leading-relaxed">{tile.helpText}</p>
                      </div>
                    </div>
                  )}

                  {/* Credit cost badge */}
                  {tile.cost !== undefined && tile.cost > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-0.5 text-[9px] text-white/20 font-medium">
                      <Zap size={7} />
                      {tile.cost}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Bottom bar — Neo-clay 3D morphism ── */}
        <div className={`px-3 py-3 shrink-0 ${
          isProMode ? 'bg-red-950/30 border-t border-red-500/10' : 'bg-[#0a0e18] border-t border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-2.5">
            {/* Neo-clay Vocal button */}
            <button
              onClick={() => { if (isInstrumental) onToggleInstrumental() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-bold transition-all duration-300 ${
                !isInstrumental
                  ? isProMode
                    ? 'bg-gradient-to-b from-red-400 via-red-500 to-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)] active:translate-y-[1px]'
                    : 'bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-600 text-white shadow-[0_4px_12px_rgba(34,211,238,0.4),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(34,211,238,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.15)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] active:translate-y-[1px]'
                  : 'bg-gradient-to-b from-white/[0.08] via-white/[0.05] to-white/[0.02] text-white/35 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:text-white/55 hover:from-white/[0.12] hover:via-white/[0.07] hover:to-white/[0.03]'
              }`}
            >
              <Mic size={13} /> Vocal
            </button>

            {/* Neo-clay Inst button */}
            <button
              onClick={() => { if (!isInstrumental) onToggleInstrumental() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-bold transition-all duration-300 ${
                isInstrumental
                  ? isProMode
                    ? 'bg-gradient-to-b from-red-400 via-red-500 to-red-600 text-white shadow-[0_4px_12px_rgba(239,68,68,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-2px_4px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.2)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)] active:translate-y-[1px]'
                    : 'bg-gradient-to-b from-violet-400 via-purple-500 to-purple-700 text-white shadow-[0_4px_12px_rgba(139,92,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.5),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.15)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] active:translate-y-[1px]'
                  : 'bg-gradient-to-b from-white/[0.08] via-white/[0.05] to-white/[0.02] text-white/35 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:text-white/55 hover:from-white/[0.12] hover:via-white/[0.07] hover:to-white/[0.03]'
              }`}
            >
              <Music size={13} /> Inst
            </button>

            {/* Neo-clay Clear button */}
            <button
              onClick={onClearChat}
              className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-white/[0.02] text-white/25 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:text-red-400 hover:from-red-500/20 hover:via-red-500/10 hover:to-red-600/5 hover:shadow-[0_4px_12px_rgba(239,68,68,0.2),inset_0_1px_1px_rgba(255,255,255,0.1)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)] active:translate-y-[1px] transition-all duration-200"
              title="Clear Chat"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <style jsx>{`
          @keyframes slideInLeft {
            from { transform: translateX(-100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .animate-slideInLeft {
            animation: slideInLeft 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
        `}</style>
      </div>
    </>
  )
}
