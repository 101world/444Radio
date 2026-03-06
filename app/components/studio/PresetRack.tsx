'use client'

import React, { useState, useMemo, useCallback, useRef, memo } from 'react'
import { FX_PRESETS, FX_PRESET_CATEGORIES, type FxPreset, type FxPresetCategory } from '@/lib/fx-presets'
import { Search, X, ChevronDown, ChevronUp } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
//  FX PRESET RACK — Vertical hardware rack for 300+ FX presets
//  Brushed-metal, LED-lit, futuristic rack-mount design.
//  Shows FX_PRESETS from lib/fx-presets.ts organized by 20
//  categories. Click to apply effect chain to selected channel.
// ═══════════════════════════════════════════════════════════════

// ── Machined screw detail ──
function RackScrew({ x, y }: { x: string; y: string }) {
  return (
    <div
      className="absolute"
      style={{
        left: x, top: y, width: 7, height: 7,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #2a2d35 0%, #1a1c22 50%, #22252d 100%)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 0.5px 0 rgba(255,255,255,0.05)',
        zIndex: 20,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: '#0a0b0d', boxShadow: 'inset 0 0.5px 1px rgba(255,255,255,0.05)' }} />
      </div>
    </div>
  )
}

// ── LED status indicator ──
function StatusLED({ color, active }: { color: string; active: boolean }) {
  return (
    <div
      style={{
        width: 4, height: 4, borderRadius: '50%',
        background: active ? color : '#1a1c22',
        boxShadow: active ? `0 0 6px ${color}80, 0 0 2px ${color}40` : 'inset 0 0.5px 1px rgba(0,0,0,0.5)',
        transition: 'all 150ms',
      }}
    />
  )
}

// ── Target badge chip ──
function TargetBadge({ target }: { target: string }) {
  const cfg = target === 'instrument'
    ? { label: 'INST', bg: '#8b5cf610', color: '#8b5cf6', border: '#8b5cf615' }
    : target === 'sound'
      ? { label: 'SND', bg: '#f9731610', color: '#f97316', border: '#f9731615' }
      : { label: 'ALL', bg: '#7fa99810', color: '#7fa998', border: '#7fa99815' }

  return (
    <span className="text-[5px] font-black tracking-[.1em] px-1 py-0.5 rounded"
      style={{ background: cfg.bg, color: cfg.color, border: `0.5px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

interface PresetRackProps {
  /** Currently selected channel index (-1 = no selection) */
  selectedChannel: number
  /** Callback to apply preset effects to channel */
  onApplyPreset: (channelIdx: number, effects: string[]) => void
  /** Number of channels for target info */
  channelCount: number
}

export default memo(function PresetRack({ selectedChannel, onApplyPreset, channelCount }: PresetRackProps) {
  const [activeCategory, setActiveCategory] = useState<FxPresetCategory>('synth')
  const [search, setSearch] = useState('')
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Current category info
  const currentCatInfo = useMemo(
    () => FX_PRESET_CATEGORIES.find(c => c.key === activeCategory) || FX_PRESET_CATEGORIES[0],
    [activeCategory]
  )

  // Filtered presets
  const filteredPresets = useMemo(() => {
    const q = search.toLowerCase().trim()
    return FX_PRESETS.filter(p =>
      p.category === activeCategory &&
      (!q || p.name.toLowerCase().includes(q) || p.tags.some(t => t.includes(q)) || p.desc.toLowerCase().includes(q))
    )
  }, [activeCategory, search])

  const handleApply = useCallback((preset: FxPreset) => {
    if (selectedChannel >= 0) {
      onApplyPreset(selectedChannel, preset.effects)
    }
  }, [selectedChannel, onApplyPreset])

  const toggleCategory = useCallback((key: FxPresetCategory) => {
    setActiveCategory(key)
    setSearch('')
    setExpandedPreset(null)
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(180deg, #0e1014 0%, #0b0c0f 50%, #0e1014 100%)',
        borderLeft: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Rack screws */}
      <RackScrew x="3px" y="3px" />
      <RackScrew x="calc(100% - 10px)" y="3px" />
      <RackScrew x="3px" y="calc(100% - 10px)" />
      <RackScrew x="calc(100% - 10px)" y="calc(100% - 10px)" />

      {/* ══ HEADER — Machined title strip ══ */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5"
        style={{
          background: 'linear-gradient(180deg, #18191f 0%, #111318 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), 0 2px 6px #050607',
        }}
      >
        <StatusLED color="#7fa998" active />
        <span className="text-[7px] font-black tracking-[.18em] uppercase" style={{ color: '#7fa998' }}>
          FX PRESETS
        </span>
        <div className="flex-1" />
        <span className="text-[6px] font-mono font-bold" style={{ color: '#3a3d44' }}>
          {FX_PRESETS.length}
        </span>

        {/* Channel target indicator */}
        {selectedChannel >= 0 ? (
          <span className="text-[6px] font-black px-1.5 py-0.5 rounded-md"
            style={{
              background: '#7fa99812',
              color: '#7fa998',
              border: '0.5px solid #7fa99820',
            }}>
            CH{selectedChannel + 1}
          </span>
        ) : (
          <span className="text-[6px] font-black px-1.5 py-0.5 rounded-md"
            style={{ color: '#ef4444', background: '#ef444412', border: '0.5px solid #ef444420' }}>
            NO CH
          </span>
        )}
      </div>

      {/* ══ SEARCH BAR — recessed input ══ */}
      <div className="shrink-0 px-2 py-1.5" style={{ background: '#0c0d10' }}>
        <div className="relative">
          <Search size={8} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: '#3a3d44' }} />
          <input
            type="text"
            placeholder="Search presets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-6 pr-7 py-1 text-[8px] font-mono rounded-lg outline-none"
            style={{
              background: '#080910',
              color: '#9aa7b3',
              border: '1px solid rgba(255,255,255,0.04)',
              boxShadow: 'inset 2px 2px 4px #050607, inset -1px -1px 3px #1a1d22',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-80"
              style={{ background: 'none', border: 'none', color: '#5a616b' }}>
              <X size={8} />
            </button>
          )}
        </div>
      </div>

      {/* ══ CATEGORY SELECTOR — compact pill grid ══ */}
      <div className="shrink-0 px-1.5 py-1"
        style={{
          background: 'linear-gradient(180deg, #111318 0%, #0e1014 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        {/* Collapse/expand toggle */}
        <button
          onClick={() => setCollapsedCategories(!collapsedCategories)}
          className="flex items-center gap-1 w-full px-1 py-0.5 cursor-pointer mb-0.5"
          style={{ background: 'none', border: 'none', color: '#4a4e56' }}
        >
          {collapsedCategories ? <ChevronDown size={7} /> : <ChevronUp size={7} />}
          <span className="text-[5px] font-black tracking-[.15em] uppercase">CATEGORIES</span>
          <div className="flex-1 h-px ml-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </button>

        {!collapsedCategories && (
          <div className="flex flex-wrap gap-[3px]">
            {FX_PRESET_CATEGORIES.map(cat => {
              const isActive = cat.key === activeCategory
              const count = FX_PRESETS.filter(p => p.category === cat.key).length
              return (
                <button
                  key={cat.key}
                  onClick={() => toggleCategory(cat.key)}
                  className="cursor-pointer transition-all duration-[120ms] active:scale-95"
                  style={{
                    padding: '2px 5px',
                    fontSize: '6px', fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
                    borderRadius: '6px',
                    color: isActive ? cat.color : '#4a4e56',
                    background: isActive
                      ? `linear-gradient(135deg, ${cat.color}12 0%, ${cat.color}06 100%)`
                      : 'transparent',
                    border: isActive ? `1px solid ${cat.color}20` : '1px solid transparent',
                    boxShadow: isActive
                      ? `inset 0 1px 0 rgba(255,255,255,0.03), 0 0 6px ${cat.color}08`
                      : 'none',
                    lineHeight: 1.2,
                  }}
                  title={`${cat.label} (${count})`}
                >
                  <span className="mr-0.5">{cat.icon}</span>
                  {cat.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ══ CATEGORY HEADER — current section label ══ */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1"
        style={{
          background: `linear-gradient(90deg, ${currentCatInfo.color}08 0%, transparent 100%)`,
          borderBottom: `1px solid ${currentCatInfo.color}10`,
        }}
      >
        <span className="text-sm">{currentCatInfo.icon}</span>
        <span className="text-[7px] font-black tracking-[.12em] uppercase" style={{ color: currentCatInfo.color }}>
          {currentCatInfo.label}
        </span>
        <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${currentCatInfo.color}12 0%, transparent 100%)` }} />
        <span className="text-[6px] font-bold font-mono" style={{ color: '#3a3d44' }}>
          {filteredPresets.length}
        </span>
      </div>

      {/* ══ PRESET LIST — scrollable vertical list ══ */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto py-1 px-1.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2d35 transparent' }}
      >
        {filteredPresets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 gap-1">
            <span className="text-[8px] font-bold" style={{ color: '#3a3d44' }}>No presets found</span>
            <span className="text-[6px]" style={{ color: '#2a2d35' }}>Try a different search or category</span>
          </div>
        ) : (
          filteredPresets.map(preset => {
            const isExpanded = expandedPreset === preset.id
            const catInfo = FX_PRESET_CATEGORIES.find(c => c.key === preset.category) || currentCatInfo
            const canApply = selectedChannel >= 0

            return (
              <div
                key={preset.id}
                className="mb-1 rounded-lg overflow-hidden transition-all duration-[120ms]"
                style={{
                  background: isExpanded
                    ? `linear-gradient(135deg, ${catInfo.color}08 0%, #12141a 100%)`
                    : '#12141a',
                  border: isExpanded
                    ? `1px solid ${catInfo.color}18`
                    : '1px solid rgba(255,255,255,0.03)',
                  boxShadow: '2px 2px 5px #050607, -1px -1px 3px #1a1d22',
                }}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-strudel-preset', JSON.stringify(preset))
                  e.dataTransfer.setData('application/x-strudel-fx', JSON.stringify({
                    ...preset,
                    code: preset.effects[0],
                    label: preset.name,
                    icon: catInfo.icon,
                  }))
                  e.dataTransfer.effectAllowed = 'copyMove'
                }}
              >
                {/* Preset header row */}
                <div
                  className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer hover:brightness-110 transition-all"
                  onClick={() => setExpandedPreset(isExpanded ? null : preset.id)}
                >
                  {/* LED */}
                  <StatusLED color={catInfo.color} active={isExpanded} />

                  {/* Name */}
                  <span className="text-[7px] font-black tracking-[.08em] uppercase flex-1 min-w-0 truncate"
                    style={{ color: isExpanded ? catInfo.color : '#8a8f9a' }}>
                    {preset.name}
                  </span>

                  {/* Target + FX count */}
                  <TargetBadge target={preset.target} />
                  <span className="text-[5px] font-mono font-bold" style={{ color: '#3a3d44' }}>
                    {preset.effects.length}fx
                  </span>

                  {/* Expand arrow */}
                  {isExpanded ? <ChevronUp size={7} style={{ color: '#4a4e56' }} /> : <ChevronDown size={7} style={{ color: '#2a2d35' }} />}
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div className="px-2 pb-2 space-y-1.5" style={{ borderTop: `1px solid ${catInfo.color}0a` }}>
                    {/* Description */}
                    <p className="text-[6px] leading-relaxed pt-1" style={{ color: '#6b7280' }}>
                      {preset.desc}
                    </p>

                    {/* Effect chain display */}
                    <div className="flex flex-wrap gap-[3px]">
                      {preset.effects.map((fx, i) => (
                        <span key={i} className="text-[5.5px] font-mono px-1 py-0.5 rounded"
                          style={{
                            background: '#080910',
                            color: catInfo.color,
                            border: `0.5px solid ${catInfo.color}15`,
                            boxShadow: 'inset 1px 1px 2px #050607',
                          }}>
                          {fx}
                        </span>
                      ))}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {preset.tags.map((tag, i) => (
                        <span key={i} className="text-[5px] font-bold px-1 py-0.5 rounded"
                          style={{ background: '#0a0b0d', color: '#4a4e56', border: '0.5px solid rgba(255,255,255,0.04)' }}>
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Apply button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleApply(preset) }}
                      disabled={!canApply}
                      className="w-full py-1.5 rounded-lg cursor-pointer transition-all duration-[150ms] active:scale-[0.98]"
                      style={{
                        background: canApply
                          ? `linear-gradient(135deg, ${catInfo.color}18 0%, ${catInfo.color}08 100%)`
                          : '#0a0b0d',
                        border: canApply
                          ? `1px solid ${catInfo.color}25`
                          : '1px solid rgba(255,255,255,0.04)',
                        color: canApply ? catInfo.color : '#3a3d44',
                        fontSize: '7px', fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase',
                        boxShadow: canApply
                          ? `0 0 8px ${catInfo.color}10, 2px 2px 4px #050607, -1px -1px 3px #1a1d22`
                          : 'inset 1px 1px 3px #050607',
                        cursor: canApply ? 'pointer' : 'not-allowed',
                        opacity: canApply ? 1 : 0.5,
                      }}
                    >
                      {canApply ? `⚡ Apply to CH${selectedChannel + 1}` : '— Select a channel —'}
                    </button>

                    {/* Drag hint */}
                    <div className="text-center">
                      <span className="text-[5px] font-mono" style={{ color: '#2a2d35' }}>
                        or drag → channel strip
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* ══ FOOTER — status strip ══ */}
      <div
        className="shrink-0 flex items-center gap-1.5 px-2.5 py-1"
        style={{
          background: 'linear-gradient(180deg, #111318 0%, #0e1014 100%)',
          borderTop: '1px solid rgba(255,255,255,0.03)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        <StatusLED color="#22d3ee" active={selectedChannel >= 0} />
        <span className="text-[5px] font-bold tracking-[.1em] uppercase" style={{ color: '#3a3d44' }}>
          {channelCount} CH · {filteredPresets.length} PRESETS · DRAG OR CLICK TO APPLY
        </span>
      </div>

      {/* ── Brushed metal texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background: 'repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.003) 1px, rgba(255,255,255,0.003) 2px)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  )
})
