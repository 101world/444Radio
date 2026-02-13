'use client'

import { useEffect, useState } from 'react'

interface MetadataStrengthMeterProps {
  trackId: string
  /** Pass a pre-fetched score to avoid an API call */
  initialScore?: number
  /** Compact mode for cards */
  compact?: boolean
  className?: string
}

interface Breakdown {
  coreIdentity: SectionBreakdown
  sonicDNA: SectionBreakdown
  discoverySignals: SectionBreakdown
  aiProvenance: SectionBreakdown
  bonus: SectionBreakdown
}

interface SectionBreakdown {
  score: number
  max: number
  fields: Record<string, { filled: boolean; points: number }>
}

export default function MetadataStrengthMeter({
  trackId,
  initialScore,
  compact = false,
  className = '',
}: MetadataStrengthMeterProps) {
  const [score, setScore] = useState(initialScore ?? 0)
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(!initialScore)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (initialScore != null) {
      setScore(initialScore)
      setLabel(getLabel(initialScore))
      setLoading(false)
      return
    }

    async function fetchStrength() {
      try {
        const res = await fetch(`/api/ownership/metadata-strength?trackId=${trackId}`)
        if (res.ok) {
          const data = await res.json()
          setScore(data.metadataStrength)
          setLabel(data.label)
          setBreakdown(data.breakdown)
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }

    fetchStrength()
  }, [trackId, initialScore])

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-800 rounded-lg h-8 w-32 ${className}`} />
    )
  }

  const color = getColor(score)
  const barWidth = `${Math.max(score, 3)}%`

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color.bg}`}
            style={{ width: barWidth }}
          />
        </div>
        <span className={`text-xs font-mono ${color.text}`}>{score}%</span>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-xl p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300">Release Strength</span>
          <span className={`text-lg font-bold font-mono ${color.text}`}>{score}%</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${color.badge}`}>
          {label || getLabel(score)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color.bg}`}
          style={{ width: barWidth }}
        />
      </div>

      {/* Breakdown toggle */}
      {breakdown && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? '▼ Hide breakdown' : '▶ Show breakdown'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3">
              {Object.entries(breakdown).map(([key, section]) => (
                <SectionBar
                  key={key}
                  name={formatSectionName(key)}
                  section={section}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Signature */}
      <div className="mt-3 pt-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-600 font-mono">
          Minted on 444Radio • AI-Native Music Network
        </p>
      </div>
    </div>
  )
}

function SectionBar({ name, section }: { name: string; section: SectionBreakdown }) {
  const pct = section.max > 0 ? Math.round((section.score / section.max) * 100) : 0
  const color = getColor(pct)
  const missingFields = Object.entries(section.fields)
    .filter(([, f]) => !f.filled)
    .map(([k]) => formatFieldName(k))

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-gray-400">{name}</span>
        <span className={`font-mono ${color.text}`}>
          {section.score}/{section.max}
        </span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.bg}`}
          style={{ width: `${Math.max(pct, 2)}%` }}
        />
      </div>
      {missingFields.length > 0 && (
        <p className="text-[10px] text-gray-600 mt-0.5">
          Missing: {missingFields.join(', ')}
        </p>
      )}
    </div>
  )
}

function getLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Work'
}

function getColor(score: number) {
  if (score >= 80) return { text: 'text-emerald-400', bg: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400' }
  if (score >= 60) return { text: 'text-blue-400', bg: 'bg-blue-500', badge: 'bg-blue-500/20 text-blue-400' }
  if (score >= 40) return { text: 'text-yellow-400', bg: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400' }
  return { text: 'text-red-400', bg: 'bg-red-500', badge: 'bg-red-500/20 text-red-400' }
}

function formatSectionName(key: string): string {
  const map: Record<string, string> = {
    coreIdentity: '🎵 Core Identity',
    sonicDNA: '🧬 Sonic DNA',
    discoverySignals: '🔍 Discovery Signals',
    aiProvenance: '🤖 AI Provenance',
    bonus: '⭐ Bonus',
  }
  return map[key] || key
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}
