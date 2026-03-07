'use client'

import StudioKnob from './StudioKnob'

interface SliderDef {
  min: number
  max: number
  value: number
}

interface StudioSliderPanelProps {
  sliderDefs: Record<string, SliderDef>
  sliderValues: React.MutableRefObject<Record<string, number>>
  onChange: (id: string, val: number) => void
}

export default function StudioSliderPanel({ sliderDefs, sliderValues, onChange }: StudioSliderPanelProps) {
  const entries = Object.entries(sliderDefs)
  if (entries.length === 0) return null

  return (
    <div className="p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="text-[8px] font-bold uppercase tracking-[.2em] mb-2 px-1" style={{ color: '#00e5c7' }}>
        LIVE KNOBS
      </div>
      <div className="flex flex-wrap gap-1 justify-center">
        {entries.map(([id, def]) => (
          <StudioKnob
            key={id}
            label={id}
            value={sliderValues.current[id] ?? def.value}
            min={def.min}
            max={def.max}
            step={(def.max - def.min) / 200}
            size={32}
            color="#00e5c7"
            onChange={(v) => onChange(id, v)}
          />
        ))}
      </div>
    </div>
  )
}
