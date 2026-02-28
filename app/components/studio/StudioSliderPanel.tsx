'use client'

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
    <div className="p-2 border-b border-white/[0.06]">
      <div className="text-[8px] font-bold uppercase tracking-[.2em] text-cyan-400/40 mb-2 px-1">
        LIVE SLIDERS
      </div>
      <div className="space-y-1.5">
        {entries.map(([id, def]) => (
          <div key={id} className="flex items-center gap-2 px-1">
            <span className="text-[8px] text-white/30 font-mono truncate w-12">{id}</span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={(def.max - def.min) / 200}
              value={sliderValues.current[id] ?? def.value}
              onChange={(e) => onChange(id, parseFloat(e.target.value))}
              className="flex-1 h-1 accent-cyan-400 cursor-pointer"
            />
            <span className="text-[9px] text-cyan-400/60 font-mono w-8 text-right">
              {(sliderValues.current[id] ?? def.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
