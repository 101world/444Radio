'use client'

import { useState } from 'react'
import GlassModal from './GlassModal'

interface EffectParameter {
  id: string
  label: string
  type: 'slider' | 'select' | 'checkbox' | 'number'
  value: number | string | boolean
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
  unit?: string
}

interface EffectModalProps {
  isOpen: boolean
  onClose: () => void
  effectName: string
  parameters: EffectParameter[]
  onApply: (values: Record<string, number | string | boolean>) => void
  onPreview?: (values: Record<string, number | string | boolean>) => void
}

export default function EffectModal({
  isOpen,
  onClose,
  effectName,
  parameters,
  onApply,
  onPreview
}: EffectModalProps) {
  const [values, setValues] = useState<Record<string, number | string | boolean>>(() => {
    const initial: Record<string, number | string | boolean> = {}
    parameters.forEach(param => {
      initial[param.id] = param.value
    })
    return initial
  })

  const handleChange = (id: string, newValue: number | string | boolean) => {
    const updated = { ...values, [id]: newValue }
    setValues(updated)
    if (onPreview) {
      onPreview(updated)
    }
  }

  const handleApply = () => {
    onApply(values)
    onClose()
  }

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={effectName}
      width="md"
      buttons={[
        { label: 'Apply', onClick: handleApply, variant: 'primary' }
      ]}
    >
      <div className="space-y-6">
        {parameters.map((param) => (
          <div key={param.id} className="space-y-2">
            <label className="flex items-center justify-between text-sm font-medium text-gray-300">
              <span>{param.label}</span>
              {param.type !== 'checkbox' && (
                <span className="text-purple-400 font-mono">
                  {typeof values[param.id] === 'number' 
                    ? (values[param.id] as number).toFixed(param.step && param.step < 1 ? 2 : 0)
                    : values[param.id]
                  }
                  {param.unit && ` ${param.unit}`}
                </span>
              )}
            </label>

            {param.type === 'slider' && (
              <input
                type="range"
                min={param.min}
                max={param.max}
                step={param.step || 1}
                value={values[param.id] as number}
                onChange={(e) => handleChange(param.id, parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
            )}

            {param.type === 'number' && (
              <input
                type="number"
                min={param.min}
                max={param.max}
                step={param.step || 1}
                value={values[param.id] as number}
                onChange={(e) => handleChange(param.id, parseFloat(e.target.value))}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            )}

            {param.type === 'select' && (
              <select
                value={values[param.id] as string}
                onChange={(e) => handleChange(param.id, e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {param.options?.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-gray-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {param.type === 'checkbox' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[param.id] as boolean}
                  onChange={(e) => handleChange(param.id, e.target.checked)}
                  className="w-5 h-5 accent-purple-500 rounded"
                />
                <span className="text-gray-400 text-sm">Enable</span>
              </label>
            )}
          </div>
        ))}
      </div>
    </GlassModal>
  )
}
