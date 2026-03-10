'use client'

import { Music, Sparkles, Repeat, Image as ImageIcon, Edit3, Rocket, Upload, X, Mic, Zap, Film, Scissors, Lightbulb, ChevronLeft, Volume2, Layers, AudioLines, RefreshCw, AudioWaveform, Wand2, Replace, Headphones, MicVocal, Crown, HelpCircle, Globe, Store } from 'lucide-react'
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
  onShowCoverArt: () => void
  onOpenRelease: () => void
  onShowListTrack: () => void
  onShowProExtend: () => void
  onShowProInpaint: () => void
  onShowProRemix: () => void
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
  onShowCoverArt,
  onOpenRelease,
  onShowListTrack,
  onShowProExtend,
  onShowProInpaint,
  onShowProRemix,
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
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [selectedLang, setSelectedLang] = useState('English')

  if (!isOpen) return null

  // ═══ TILE DEFINITIONS — unified cyan (standard) / glassmorphism (pro) ═══
  const tileGrad = isProMode
    ? 'from-white/[0.06] via-white/[0.03] to-white/[0.01]'
    : 'from-cyan-500/20 via-cyan-600/12 to-cyan-700/18'
  const tileGlow = isProMode ? 'shadow-white/15' : 'shadow-cyan-500/20'
  const tileActiveGrad = isProMode
    ? 'from-white/[0.14] via-white/[0.08] to-white/[0.04] ring-white/30'
    : 'from-cyan-400/45 via-cyan-500/35 to-cyan-600/40 ring-cyan-400/60'
  // Keep helpers for backward compat — they now return unified values
  const proGradient = (_base: string) => tileGrad
  const proGlow = (_base: string) => tileGlow
  const proActiveGrad = (_base: string) => tileActiveGrad

  const sections: Record<string, { label: string; emoji: string; tiles: Tile[] }> = {
    create: {
      label: 'Create',
      emoji: '🎵',
      tiles: [
        {
          icon: Music, label: 'Music', desc: 'AI song generation',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: selectedType === 'music' && !isInstrumental, cost: 2,
          onClick: () => { onSelectType('music'); if (isInstrumental) onToggleInstrumental() },
        },
        {
          icon: Music, label: 'Inst.', desc: 'No vocals, pure sound',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: selectedType === 'music' && isInstrumental, cost: 2,
          onClick: () => { onSelectType('music'); if (!isInstrumental) onToggleInstrumental() },
        },
        {
          icon: AudioLines, label: 'Samples', desc: 'AI drums & samples',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 2,
          onClick: onShowBeatMaker,
        },
        {
          icon: ImageIcon, label: 'Art', desc: 'AI album artwork',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: selectedType === 'image', cost: 1,
          onClick: () => { onSelectType('image'); onShowCoverArt() },
        },
        {
          icon: Repeat, label: '444 Remix', desc: 'Remix any song',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 3,
          onClick: onShowProRemix,
          helpText: 'Upload any song and remix it in a new style using 444 Remix Engine. 3 credits.',
        },
        {
          icon: Edit3, label: 'Lyrics', desc: 'Write & edit words',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: !!(customTitle || genre || customLyrics || bpm),
          onClick: onShowLyrics,
          hidden: selectedType !== 'music' || isInstrumental,
        },
      ],
    },
    fx: {
      label: 'SFX',
      emoji: '✨',
      tiles: [
        {
          icon: Sparkles, label: 'Score', desc: 'Background scoring SFX',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 2,
          onClick: onShowEffects,
        },
        {
          icon: Repeat, label: 'Loops', desc: 'Fixed BPM loops',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 6,
          onClick: onShowLoopers,
        },
        {
          icon: Music, label: 'Chords', desc: 'Chord & rhythm control',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 4,
          onClick: onShowMusiConGen,
        },
        {
          icon: Volume2, label: 'Boost', desc: 'Mix & master audio',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
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
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 0,
          onClick: onShowStemSplit,
        },
        {
          icon: Layers, label: 'Extract', desc: 'Pull audio from media',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 1,
          onClick: onShowExtract,
        },
        {
          icon: Mic, label: 'Auto Tune', desc: 'Pitch correct vocals',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false, cost: 1,
          onClick: onShowAutotune,
        },
        {
          icon: Film, label: 'Visualizer', desc: 'Text/Image to video',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false,
          onClick: onShowVisualizer,
        },
        {
          icon: Mic, label: 'Lip Sync', desc: 'Image + audio to video',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false,
          onClick: onShowLipSync,
        },
        {
          icon: Film, label: 'Vid→Aud', desc: 'Synced SFX from video',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
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
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false,
          onClick: onShowUpload, size: 'wide',
        },
        {
          icon: Rocket, label: 'Release', desc: 'Publish to feed',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false,
          onClick: onOpenRelease, size: 'wide',
        },
        {
          icon: Store, label: 'List Track', desc: 'Sell on marketplace',
          gradient: tileGrad,
          glowColor: tileGlow,
          activeGradient: tileActiveGrad,
          active: false,
          onClick: onShowListTrack, size: 'wide',
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
        gradient: tileGrad,
        glowColor: tileGlow,
        activeGradient: tileActiveGrad,
        active: false, cost: 4,
        onClick: onShowProExtend,
        helpText: 'Upload audio or paste a URL. Choose to extend from the end (right) or add a new intro (left). 4 credits.',
      },
      {
        icon: Replace, label: 'Inpaint', desc: 'Replace a section in a track',
        gradient: tileGrad,
        glowColor: tileGlow,
        activeGradient: tileActiveGrad,
        active: false, cost: 4,
        onClick: onShowProInpaint,
        helpText: 'Upload audio and set start/end times for the section to replace. Add style tags. 4 credits.',
      },
      {
        icon: RefreshCw, label: '444 Remix', desc: 'Remix any song in a new style',
        gradient: tileGrad,
        glowColor: tileGlow,
        activeGradient: tileActiveGrad,
        active: false, cost: 3,
        onClick: onShowProRemix,
        helpText: 'Upload any song — with or without vocals. 444 Remix re-creates it in a brand new style. 3 credits.',
      },
      {
        icon: MicVocal, label: 'Add Vocals', desc: 'AI vocals on instrumental',
        gradient: tileGrad,
        glowColor: tileGlow,
        activeGradient: tileActiveGrad,
        active: false, cost: 5,
        onClick: onShowProAddVocals,
        helpText: 'Upload an instrumental track. The AI generates lyrics/vocals and layers them on top. 5 credits.',
      },
      {
        icon: Headphones, label: 'Melody→Song', desc: 'Hum/sing → full track',
        gradient: tileGrad,
        glowColor: tileGlow,
        activeGradient: tileActiveGrad,
        active: false, cost: 5,
        onClick: onShowProVoiceToMelody,
        helpText: 'Upload a vocal recording or hum. The AI creates full instrumental backing to match your melody. 5 credits.',
      },
    ],
  }

  const sectionKeys: ('create' | 'pro' | 'fx' | 'process' | 'publish')[] = ['create', 'pro', 'fx', 'process', 'publish']
  const currentSection = sections[activeSection] || sections.create
  const visibleTiles = currentSection.tiles.filter(t => !t.hidden)

  const tabIcons: Record<string, { icon: any; label: string }> = {
    create: { icon: Music, label: 'Create' },
    pro: { icon: Crown, label: 'Advanced' },
    fx: { icon: Sparkles, label: 'SFX' },
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
          ? 'bg-gradient-to-b from-[#070709] via-[#050507] to-[#030305] md:border-r md:border-white/[0.12]'
          : 'bg-gradient-to-b from-[#080c14] via-[#060a12] to-[#040810] md:border-r md:border-white/[0.08]'
      }`}>

        {/* ── Frosted header ── */}
        <div className={`flex items-center justify-between px-4 h-14 shrink-0 backdrop-blur-xl ${
          isProMode ? 'bg-white/[0.02] border-b border-white/[0.08]' : 'bg-white/[0.02] border-b border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isProMode
                ? 'bg-gradient-to-br from-white/[0.12] to-white/[0.06] shadow-lg shadow-white/10'
                : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/20 shadow-lg shadow-cyan-500/20'
            }`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={isProMode ? 'text-white' : 'text-cyan-400'}>
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
                ? 'bg-white/[0.08] text-white border border-white/[0.15]'
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
            isProMode ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-white/[0.03] border border-white/[0.06]'
          }`}>
            {sectionKeys.map(key => {
              const tab = tabIcons[key]
              const Icon = tab.icon
              const isActive = activeSection === key
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold tracking-wide transition-all duration-200 ${
                    isActive
                      ? isProMode
                        ? 'bg-white/[0.12] text-white shadow-sm shadow-white/10 border border-white/[0.15]'
                        : 'bg-cyan-500/20 text-cyan-300 shadow-sm shadow-cyan-500/10 border border-cyan-500/20'
                      : isProMode
                        ? 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
                        : 'text-white/30 hover:text-white/50 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon size={11} />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Prompt input (compact, elegant) ── */}
        <div className="px-3 py-2 shrink-0">
          <div className={`rounded-2xl p-0.5 ${
            isProMode
              ? 'bg-gradient-to-r from-white/[0.1] via-white/[0.05] to-white/[0.1]'
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
                  {/* Language selector */}
                  <div className="relative">
                    <button
                      onClick={() => setShowLangMenu(!showLangMenu)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                        showLangMenu
                          ? isProMode ? 'bg-white/[0.12] text-white' : 'bg-cyan-500/20 text-cyan-300'
                          : 'bg-white/[0.06] hover:bg-white/[0.1] text-white/30 hover:text-cyan-400'
                      }`}
                      title={`Language: ${selectedLang}`}
                    >
                      <Globe size={12} />
                    </button>
                    {showLangMenu && (
                      <div className="absolute bottom-9 left-0 z-50 w-36 py-1 rounded-xl bg-black/95 border border-white/10 shadow-xl backdrop-blur-xl max-h-48 overflow-y-auto scrollbar-thin">
                        {['English', 'Hindi', 'Spanish', 'French', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Chinese', 'German', 'Italian', 'Russian', 'Swahili', 'Punjabi', 'Tamil'].map(lang => (
                          <button
                            key={lang}
                            onClick={() => { setSelectedLang(lang); setShowLangMenu(false) }}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-medium transition-colors ${
                              selectedLang === lang
                                ? isProMode ? 'text-white bg-white/[0.1]' : 'text-cyan-300 bg-cyan-500/10'
                                : 'text-white/50 hover:text-white/80 hover:bg-white/[0.05]'
                            }`}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedLang !== 'English' && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${
                      isProMode ? 'bg-white/[0.08] text-white/60' : 'bg-cyan-500/10 text-cyan-400/60'
                    }`}>{selectedLang}</span>
                  )}
                </div>
                <button
                  onClick={onSubmitPrompt}
                  disabled={isGenerating || !promptText.trim()}
                  className={`flex items-center gap-1.5 pl-3 pr-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:opacity-25 disabled:cursor-not-allowed ${
                    isProMode
                      ? 'bg-gradient-to-r from-white/90 to-white/70 text-black shadow-lg shadow-white/20 hover:shadow-white/40'
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
            isProMode ? 'border-b border-white/[0.06]' : 'border-b border-white/[0.06]'
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
                          ? 'bg-white/[0.08] text-white/70 hover:bg-white/[0.15] border border-white/[0.12]'
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
                    { label: '🎭 Mood & Vibe', tags: ['upbeat', 'chill', 'energetic', 'melancholic', 'dreamy', 'aggressive', 'dark', 'bright', 'nostalgic', 'romantic', 'sad', 'happy', 'mysterious', 'powerful', 'ethereal', 'groovy', 'hypnotic', 'euphoric', 'moody', 'intense', 'laid-back', 'triumphant', 'haunting', 'soothing', 'raw'] },
                    { label: '🎵 Genre', tags: ['electronic', 'acoustic', 'jazz', 'rock', 'hip-hop', 'trap', 'drill', 'phonk', 'house', 'techno', 'trance', 'dubstep', 'drum & bass', 'future bass', 'synthwave', 'vaporwave', 'lo-fi beats', 'indie', 'folk', 'blues', 'soul', 'funk', 'disco', 'reggae', 'reggaeton', 'latin', 'afrobeat', 'afro house', 'amapiano', 'k-pop', 'j-pop', 'anime', 'r&b', 'neo-soul', 'boom bap', 'country', 'gospel', 'dancehall', 'garage', 'grime', 'hardstyle', 'progressive house', 'deep house', 'minimal techno'] },
                    { label: '🎸 Instruments', tags: ['heavy bass', 'soft piano', 'guitar solo', 'synth lead', 'strings', 'brass', 'flute', 'violin', 'saxophone', 'acoustic guitar', 'electric guitar', 'grand piano', 'organ', 'cello', 'harp', 'sitar', 'tabla', 'steel drums', '808 drums', 'hi-hats', 'sub bass', 'arpeggiator', 'pad', 'pluck synth', 'marimba', 'kalimba', 'mandolin', 'banjo', 'harmonica', 'trumpet'] },
                    { label: '🎤 Vocals', tags: ['soft vocals', 'no vocals', 'female vocals', 'male vocals', 'male & female duet', 'raspy vocals', 'falsetto', 'autotune', 'choir', 'harmonies', 'whisper vocals', 'spoken word', 'rap verse', 'melodic rap', 'belting', 'vocal chops', 'ad-libs'] },
                    { label: '🎬 Production', tags: ['ambient', 'orchestral', 'cinematic', 'epic', 'minimalist', 'layered', 'distorted', 'reverb heavy', 'lo-fi', 'polished', 'gritty', 'spacious', 'punchy', 'warm', 'crisp', 'analog', 'glitchy', 'atmospheric', 'build-up', 'drop', 'breakdown'] },
                    { label: '📺 Use Case', tags: ['trailer', 'ad', 'commercial', 'music video', 'hollywood', 'bollywood', 'podcast intro', 'gaming', 'workout', 'meditation', 'study music', 'party', 'road trip', 'wedding', 'lullaby', 'alarm tone', 'vlog music'] },
                  ].map((section) => (
                    <div key={section.label} className="w-full">
                      <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1 mt-1.5 first:mt-0">{section.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {section.tags.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => onTagClick(tag)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all hover:scale-[1.04] ${
                              isProMode
                                ? 'bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/[0.15]'
                                : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-white/70 border border-white/[0.06] hover:border-white/[0.15]'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
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
                        ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-white/[0.12] hover:border-white/[0.2] shadow-lg shadow-white/5'
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
                        ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02] border-white/[0.12] hover:border-white/[0.2] shadow-lg shadow-white/5'
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
                  <button onClick={() => setIdeasView('type')} className={`text-[10px] hover:opacity-80 flex items-center gap-1 ${isProMode ? 'text-white/60' : 'text-cyan-400'}`}>
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
                    'soul', 'funk', 'reggae', 'reggaeton', 'latin',
                    'afrobeat', 'amapiano', 'r&b', 'neo-soul', 'boom bap',
                    'orchestral', 'cinematic', 'acoustic', 'vaporwave',
                    'k-pop', 'j-pop', 'dancehall', 'garage', 'grime',
                    'drum & bass', 'deep house', 'future bass', 'trance',
                    'disco', 'afro house', 'anime', 'country', 'gospel'
                  ].map((g) => (
                    <button
                      key={g}
                      onClick={() => { setIdeasView('generating'); onGenerateIdea(g, promptType); setTimeout(() => setIdeasView('tags'), 5000) }}
                      disabled={isGeneratingIdea}
                      className={`px-1.5 py-1.5 rounded-xl text-[10px] font-medium transition-all hover:scale-[1.04] disabled:opacity-40 border ${
                        isProMode
                          ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white/50 hover:text-white/80'
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
                  <div className={`w-10 h-10 mx-auto border-[3px] rounded-full animate-spin ${isProMode ? 'border-white/20 border-t-white/70' : 'border-cyan-500/20 border-t-cyan-400'}`} />
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
          isProMode ? 'bg-black/50 border-t border-white/[0.08]' : 'bg-[#0a0e18] border-t border-white/[0.06]'
        }`}>
          <div className="flex items-center gap-2.5">
            {/* Neo-clay Music button (was Vocal) */}
            <button
              onClick={() => { if (isInstrumental) onToggleInstrumental() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-bold transition-all duration-300 ${
                !isInstrumental
                  ? isProMode
                    ? 'bg-gradient-to-b from-white/80 via-white/70 to-white/60 text-black shadow-[0_4px_12px_rgba(255,255,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.3),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.2)] active:translate-y-[1px]'
                    : 'bg-gradient-to-b from-cyan-300 via-cyan-400 to-cyan-600 text-white shadow-[0_4px_12px_rgba(34,211,238,0.4),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_20px_rgba(34,211,238,0.5),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-2px_4px_rgba(0,0,0,0.15)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.25)] active:translate-y-[1px]'
                  : 'bg-gradient-to-b from-white/[0.08] via-white/[0.05] to-white/[0.02] text-white/35 shadow-[0_2px_6px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.05)] hover:text-white/55 hover:from-white/[0.12] hover:via-white/[0.07] hover:to-white/[0.03]'
              }`}
            >
              <Mic size={13} /> Music
            </button>

            {/* Neo-clay Inst button */}
            <button
              onClick={() => { if (!isInstrumental) onToggleInstrumental() }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[11px] font-bold transition-all duration-300 ${
                isInstrumental
                  ? isProMode
                    ? 'bg-gradient-to-b from-white/80 via-white/70 to-white/60 text-black shadow-[0_4px_12px_rgba(255,255,255,0.2),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-2px_4px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_rgba(255,255,255,0.3),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-2px_4px_rgba(0,0,0,0.1)] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.2)] active:translate-y-[1px]'
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
