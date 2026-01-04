'use client'

import { useState } from 'react'
import { X, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { GlassPanel, GlassButton, GlassKnob, GlassTooltip } from './glass'

// Effect types
export type EffectType = 'eq' | 'compressor' | 'reverb' | 'delay' | 'distortion' | 'auto-tune' | 'chorus' | 'phaser'

export interface Effect {
  id: string
  type: EffectType
  name: string
  enabled: boolean
  parameters: Record<string, number>
}

interface EffectRackProps {
  trackId: string
  trackName: string
  effects: Effect[]
  onAddEffect: (type: EffectType) => void
  onRemoveEffect: (effectId: string) => void
  onToggleEffect: (effectId: string) => void
  onUpdateParameter: (effectId: string, param: string, value: number) => void
  onReorderEffects: (startIndex: number, endIndex: number) => void
}

function EffectModule({ effect, onRemove, onToggle, onUpdateParameter }: {
  effect: Effect
  onRemove: () => void
  onToggle: () => void
  onUpdateParameter: (param: string, value: number) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)

  const renderParameters = () => {
    switch (effect.type) {
      case 'eq':
        return (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.low || 0.5}
                onChange={(val) => onUpdateParameter('low', val)}
                color="green"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Low</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.mid || 0.5}
                onChange={(val) => onUpdateParameter('mid', val)}
                color="cyan"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Mid</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.high || 0.5}
                onChange={(val) => onUpdateParameter('high', val)}
                color="purple"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">High</span>
            </div>
          </div>
        )
      case 'compressor':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.threshold || 0.5}
                onChange={(val) => onUpdateParameter('threshold', val)}
                color="pink"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Thresh</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.ratio || 0.5}
                onChange={(val) => onUpdateParameter('ratio', val)}
                color="purple"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Ratio</span>
            </div>
          </div>
        )
      case 'reverb':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.size || 0.5}
                onChange={(val) => onUpdateParameter('size', val)}
                color="purple"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Size</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.mix || 0.3}
                onChange={(val) => onUpdateParameter('mix', val)}
                color="cyan"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Mix</span>
            </div>
          </div>
        )
      case 'delay':
        return (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.time || 0.5}
                onChange={(val) => onUpdateParameter('time', val)}
                color="cyan"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Time</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.feedback || 0.3}
                onChange={(val) => onUpdateParameter('feedback', val)}
                color="purple"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Feedbk</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.mix || 0.3}
                onChange={(val) => onUpdateParameter('mix', val)}
                color="pink"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Mix</span>
            </div>
          </div>
        )
      case 'distortion':
        return (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.drive || 0.5}
                onChange={(val) => onUpdateParameter('drive', val)}
                color="pink"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Drive</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <GlassKnob
                value={effect.parameters.tone || 0.5}
                onChange={(val) => onUpdateParameter('tone', val)}
                color="purple"
                className="scale-90"
              />
              <span className="text-[9px] text-gray-500">Tone</span>
            </div>
          </div>
        )
      default:
        return (
          <div className="text-xs text-gray-400 text-center py-2">
            No parameters available
          </div>
        )
    }
  }

  return (
    <GlassPanel blur="md" glow="none" className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={onToggle}
            className={`w-6 h-3 rounded-full transition-all duration-200 ${
              effect.enabled ? 'bg-cyan-500/50 shadow-lg shadow-cyan-500/20' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full bg-white transition-all duration-200 ${
                effect.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span className="text-xs font-medium text-white">{effect.name}</span>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Parameters */}
      {isExpanded && (
        <div className="p-3">
          {renderParameters()}
        </div>
      )}
    </GlassPanel>
  )
}

export default function EffectRack({
  trackId,
  trackName,
  effects,
  onAddEffect,
  onRemoveEffect,
  onToggleEffect,
  onUpdateParameter,
  onReorderEffects
}: EffectRackProps) {
  const [showAddMenu, setShowAddMenu] = useState(false)

  const availableEffects: { type: EffectType; name: string; description: string }[] = [
    { type: 'eq', name: 'EQ', description: '3-band equalizer' },
    { type: 'compressor', name: 'Compressor', description: 'Dynamic range compression' },
    { type: 'reverb', name: 'Reverb', description: 'Room reverb' },
    { type: 'delay', name: 'Delay', description: 'Echo delay' },
    { type: 'distortion', name: 'Distortion', description: 'Overdrive/distortion' },
    { type: 'auto-tune', name: 'Auto-Tune', description: 'Pitch correction' },
    { type: 'chorus', name: 'Chorus', description: 'Chorus effect' },
    { type: 'phaser', name: 'Phaser', description: 'Phase shifter' }
  ]

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">{trackName}</h3>
          <div className="text-xs text-gray-400">{effects.length} effects</div>
        </div>
        <div className="relative">
          <GlassTooltip content="Add Effect">
            <GlassButton
              variant="secondary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowAddMenu(!showAddMenu)}
            >
              Add
            </GlassButton>
          </GlassTooltip>

          {/* Add effect menu */}
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 z-50">
              <GlassPanel blur="xl" glow="cyan" className="p-2">
                <div className="flex flex-col gap-1">
                  {availableEffects.map((fx) => (
                    <button
                      key={fx.type}
                      onClick={() => {
                        onAddEffect(fx.type)
                        setShowAddMenu(false)
                      }}
                      className="text-left px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <div className="text-xs font-medium text-white">{fx.name}</div>
                      <div className="text-[10px] text-gray-400">{fx.description}</div>
                    </button>
                  ))}
                </div>
              </GlassPanel>
            </div>
          )}
        </div>
      </div>

      {/* Effects chain */}
      <div className="flex flex-col gap-2">
        {effects.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No effects added yet. Click "Add" to add your first effect.
          </div>
        ) : (
          effects.map((effect, index) => (
            <EffectModule
              key={effect.id}
              effect={effect}
              onRemove={() => onRemoveEffect(effect.id)}
              onToggle={() => onToggleEffect(effect.id)}
              onUpdateParameter={(param, value) => onUpdateParameter(effect.id, param, value)}
            />
          ))
        )}
      </div>
    </div>
  )
}
