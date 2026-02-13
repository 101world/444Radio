'use client'

import { useState } from 'react'
import { Shield, Zap, Music, Eye, EyeOff, ChevronRight } from 'lucide-react'
import type { Atmosphere, EraVibe, TempoFeel, LicenseType444, CreationType, PromptVisibility } from '@/lib/track-id-444'

interface SonicDNAFormProps {
  initialValues?: Partial<SonicDNAValues>
  onSubmit: (values: SonicDNAValues) => void
  onBack?: () => void
  loading?: boolean
}

export interface SonicDNAValues {
  energyLevel: number | null
  danceability: number | null
  tempoFeel: TempoFeel | null
  atmosphere: Atmosphere | null
  eraVibe: EraVibe | null
  creationType: CreationType
  licenseType444: LicenseType444
  promptVisibility: PromptVisibility
  remixAllowed: boolean
  derivativeAllowed: boolean
  voiceModelUsed: string
}

const ATMOSPHERES: { value: Atmosphere; label: string; emoji: string }[] = [
  { value: 'dark', label: 'Dark', emoji: '🌑' },
  { value: 'dreamy', label: 'Dreamy', emoji: '💭' },
  { value: 'uplifting', label: 'Uplifting', emoji: '☀️' },
  { value: 'aggressive', label: 'Aggressive', emoji: '🔥' },
  { value: 'calm', label: 'Calm', emoji: '🌊' },
  { value: 'melancholic', label: 'Melancholic', emoji: '🌧️' },
  { value: 'euphoric', label: 'Euphoric', emoji: '✨' },
  { value: 'mysterious', label: 'Mysterious', emoji: '🌀' },
]

const ERA_VIBES: { value: EraVibe; label: string }[] = [
  { value: '70s', label: "70's" },
  { value: '80s', label: "80's" },
  { value: '90s', label: "90's" },
  { value: '2000s', label: "2000's" },
  { value: '2010s', label: "2010's" },
  { value: 'futuristic', label: 'Futuristic' },
  { value: 'retro', label: 'Retro' },
  { value: 'timeless', label: 'Timeless' },
]

const LICENSE_TYPES: { value: LicenseType444; label: string; desc: string }[] = [
  { value: 'fully_ownable', label: 'Fully Ownable', desc: 'Full ownership rights transfer on purchase' },
  { value: 'non_exclusive', label: 'Non-Exclusive', desc: 'Multiple users can license this track' },
  { value: 'remix_allowed', label: 'Remix Allowed', desc: 'Others can create remixes and derivatives' },
  { value: 'download_only', label: 'Download Only', desc: 'Can download but not redistribute' },
  { value: 'streaming_only', label: 'Streaming Only', desc: 'Stream only, no downloads' },
  { value: 'no_derivatives', label: 'No Derivatives', desc: 'No remixes or derivative works allowed' },
]

export default function SonicDNAForm({
  initialValues,
  onSubmit,
  onBack,
  loading = false,
}: SonicDNAFormProps) {
  const [values, setValues] = useState<SonicDNAValues>({
    energyLevel: initialValues?.energyLevel ?? null,
    danceability: initialValues?.danceability ?? null,
    tempoFeel: initialValues?.tempoFeel ?? null,
    atmosphere: initialValues?.atmosphere ?? null,
    eraVibe: initialValues?.eraVibe ?? null,
    creationType: initialValues?.creationType ?? 'ai_generated',
    licenseType444: initialValues?.licenseType444 ?? 'fully_ownable',
    promptVisibility: initialValues?.promptVisibility ?? 'private',
    remixAllowed: initialValues?.remixAllowed ?? false,
    derivativeAllowed: initialValues?.derivativeAllowed ?? false,
    voiceModelUsed: initialValues?.voiceModelUsed ?? '',
  })

  const [step, setStep] = useState<'sonic' | 'rights'>(onBack ? 'sonic' : 'sonic')

  const handleSubmit = () => {
    onSubmit(values)
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setStep('sonic')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            step === 'sonic'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
          }`}
        >
          <Music className="w-3 h-3" />
          Sound Identity
        </button>
        <ChevronRight className="w-3 h-3 text-gray-600" />
        <button
          onClick={() => setStep('rights')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
            step === 'rights'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-gray-800 text-gray-500 hover:text-gray-300'
          }`}
        >
          <Shield className="w-3 h-3" />
          Ownership & Rights
        </button>
      </div>

      {step === 'sonic' && (
        <div className="space-y-5">
          {/* Energy Level */}
          <SliderField
            label="Energy Level"
            value={values.energyLevel}
            onChange={(v) => setValues(prev => ({ ...prev, energyLevel: v }))}
            icon={<Zap className="w-3.5 h-3.5 text-orange-400" />}
            color="orange"
          />

          {/* Danceability */}
          <SliderField
            label="Danceability"
            value={values.danceability}
            onChange={(v) => setValues(prev => ({ ...prev, danceability: v }))}
            icon={<span className="text-sm">💃</span>}
            color="pink"
          />

          {/* Tempo Feel */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Tempo Feel</label>
            <div className="flex gap-2">
              {(['slow', 'mid', 'fast'] as TempoFeel[]).map(tempo => (
                <button
                  key={tempo}
                  onClick={() => setValues(prev => ({ ...prev, tempoFeel: prev.tempoFeel === tempo ? null : tempo }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm capitalize transition-colors ${
                    values.tempoFeel === tempo
                      ? 'bg-purple-500/30 border border-purple-500 text-purple-300'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {tempo}
                </button>
              ))}
            </div>
          </div>

          {/* Atmosphere */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Atmosphere</label>
            <div className="grid grid-cols-4 gap-2">
              {ATMOSPHERES.map(atm => (
                <button
                  key={atm.value}
                  onClick={() => setValues(prev => ({
                    ...prev,
                    atmosphere: prev.atmosphere === atm.value ? null : atm.value,
                  }))}
                  className={`py-2 px-2 rounded-lg text-xs text-center transition-colors ${
                    values.atmosphere === atm.value
                      ? 'bg-purple-500/30 border border-purple-500 text-purple-300'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span className="block text-base mb-0.5">{atm.emoji}</span>
                  {atm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Era Vibe */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Era Vibe</label>
            <div className="flex flex-wrap gap-2">
              {ERA_VIBES.map(era => (
                <button
                  key={era.value}
                  onClick={() => setValues(prev => ({
                    ...prev,
                    eraVibe: prev.eraVibe === era.value ? null : era.value,
                  }))}
                  className={`py-1.5 px-3 rounded-full text-xs transition-colors ${
                    values.eraVibe === era.value
                      ? 'bg-purple-500/30 border border-purple-500 text-purple-300'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {era.label}
                </button>
              ))}
            </div>
          </div>

          {/* Next button */}
          <button
            onClick={() => setStep('rights')}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Continue to Ownership & Rights
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {step === 'rights' && (
        <div className="space-y-5">
          {/* License Type */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">License Type</label>
            <div className="space-y-2">
              {LICENSE_TYPES.map(license => (
                <button
                  key={license.value}
                  onClick={() => setValues(prev => ({ ...prev, licenseType444: license.value }))}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${
                    values.licenseType444 === license.value
                      ? 'bg-purple-500/20 border border-purple-500'
                      : 'bg-gray-800 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <p className={`text-sm font-medium ${
                    values.licenseType444 === license.value ? 'text-purple-300' : 'text-gray-300'
                  }`}>
                    {license.label}
                  </p>
                  <p className="text-xs text-gray-500">{license.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <label className="text-xs text-gray-400 block">Permissions</label>
            
            <ToggleRow
              label="Allow Remixes"
              description="Other users can create remixes of this track"
              checked={values.remixAllowed}
              onChange={(v) => setValues(prev => ({ ...prev, remixAllowed: v }))}
            />
            
            <ToggleRow
              label="Allow Derivatives"
              description="Others can use stems or elements from this track"
              checked={values.derivativeAllowed}
              onChange={(v) => setValues(prev => ({ ...prev, derivativeAllowed: v }))}
            />
          </div>

          {/* Prompt Visibility */}
          <div>
            <label className="text-xs text-gray-400 mb-2 block">Generation Prompt Visibility</label>
            <div className="flex gap-2">
              <button
                onClick={() => setValues(prev => ({ ...prev, promptVisibility: 'private' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors ${
                  values.promptVisibility === 'private'
                    ? 'bg-gray-700 border border-gray-500 text-gray-200'
                    : 'bg-gray-800 border border-gray-700 text-gray-400'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Private
              </button>
              <button
                onClick={() => setValues(prev => ({ ...prev, promptVisibility: 'public' }))}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm transition-colors ${
                  values.promptVisibility === 'public'
                    ? 'bg-blue-500/20 border border-blue-500 text-blue-300'
                    : 'bg-gray-800 border border-gray-700 text-gray-400'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Public
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              Public prompts power 444Radio&apos;s prompt-indexed discovery engine
            </p>
          </div>

          {/* Voice Model */}
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Voice Model Used (optional)</label>
            <input
              type="text"
              value={values.voiceModelUsed}
              onChange={(e) => setValues(prev => ({ ...prev, voiceModelUsed: e.target.value }))}
              placeholder="e.g. ElevenLabs v2, Bark, RVC"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('sonic')}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-purple-400 text-white rounded-xl transition-colors font-medium"
            >
              {loading ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function SliderField({
  label,
  value,
  onChange,
  icon,
  color,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
  icon: React.ReactNode
  color: string
}) {
  const bgColor = color === 'orange' ? 'bg-orange-500' : 'bg-pink-500'
  
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {icon}
          <label className="text-xs text-gray-400">{label}</label>
        </div>
        <span className="text-sm font-mono text-gray-300">{value ?? '—'}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value ?? 50}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-500
          [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 transition-colors"
    >
      <div className="text-left">
        <p className="text-sm text-gray-300">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className={`w-10 h-5 rounded-full transition-colors relative ${
        checked ? 'bg-purple-500' : 'bg-gray-600'
      }`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? 'left-5' : 'left-0.5'
        }`} />
      </div>
    </button>
  )
}
