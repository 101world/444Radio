'use client'

import { useState, useEffect } from 'react'
import { Shield, Link2, Music, Fingerprint, ChevronDown, ChevronUp, Lock, Unlock, Eye, EyeOff } from 'lucide-react'
import MetadataStrengthMeter from './MetadataStrengthMeter'

interface OwnershipBadgeProps {
  trackId: string
  /** Show as minimal inline badge or expanded panel */
  variant?: 'badge' | 'panel' | 'full'
  className?: string
}

interface OwnershipData {
  trackId444: string
  creationType: string
  originalCreator: {
    id: string
    username: string | null
    profileImage: string | null
  }
  licenseType: string
  remixAllowed: boolean
  derivativeAllowed: boolean
  generationModel: string | null
  promptVisibility: string
  sonicDNA: {
    genre: string | null
    mood: string | null
    bpm: number | null
    keySignature: string | null
    energyLevel: number | null
    danceability: number | null
    tempoFeel: string | null
    atmosphere: string | null
    eraVibe: string | null
  }
  metadataStrength: number
  fingerprint: {
    waveformHash: string
    aiFingerprint: string
    durationMs: number | null
    detectedBpm: number | null
    detectedKey: string | null
  } | null
  lineage: Array<{
    transaction_type: string
    current_owner_id: string
    created_at: string
  }>
  currentUserPermissions: {
    isOwner: boolean
    isOriginalCreator: boolean
    canRemix: boolean
    remixReason: string
  }
  mintedOn: string
}

export default function OwnershipBadge({
  trackId,
  variant = 'badge',
  className = '',
}: OwnershipBadgeProps) {
  const [data, setData] = useState<OwnershipData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(variant === 'full')

  useEffect(() => {
    async function fetchOwnership() {
      try {
        const res = await fetch(`/api/ownership/track/${trackId}`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    fetchOwnership()
  }, [trackId])

  if (loading) {
    return <div className={`animate-pulse bg-gray-800 rounded h-6 w-24 ${className}`} />
  }

  if (!data) return null

  // Minimal badge view
  if (variant === 'badge') {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-800/80 border border-gray-700 ${className}`}>
        <Shield className="w-3 h-3 text-purple-400" />
        <span className="text-[10px] font-mono text-gray-400">{data.trackId444}</span>
        <span className="text-[10px] text-gray-600">•</span>
        <span className="text-[10px] text-gray-500">{formatCreationType(data.creationType)}</span>
      </div>
    )
  }

  // Panel and full views
  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-purple-400">{data.trackId444}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${getCreationTypeBadge(data.creationType)}`}>
                {formatCreationType(data.creationType)}
              </span>
            </div>
            <p className="text-[10px] text-gray-500">
              Created by @{data.originalCreator.username || 'unknown'}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Ownership & Rights */}
          <Section title="Ownership & Rights" icon={<Lock className="w-3.5 h-3.5" />}>
            <InfoRow label="Original Creator" value={`@${data.originalCreator.username || data.originalCreator.id}`} />
            <InfoRow label="License" value={formatLicense(data.licenseType)} />
            <InfoRow
              label="Remix Allowed"
              value={data.remixAllowed ? 'Yes' : 'No'}
              icon={data.remixAllowed ? <Unlock className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-red-400" />}
            />
            <InfoRow
              label="Derivatives"
              value={data.derivativeAllowed ? 'Allowed' : 'Not Allowed'}
              icon={data.derivativeAllowed ? <Unlock className="w-3 h-3 text-green-400" /> : <Lock className="w-3 h-3 text-red-400" />}
            />
          </Section>

          {/* Sonic DNA */}
          <Section title="Sonic DNA" icon={<Music className="w-3.5 h-3.5" />}>
            {data.sonicDNA.bpm && <InfoRow label="BPM" value={String(data.sonicDNA.bpm)} />}
            {data.sonicDNA.keySignature && <InfoRow label="Key" value={data.sonicDNA.keySignature} />}
            {data.sonicDNA.energyLevel != null && (
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-gray-500">Energy</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{ width: `${data.sonicDNA.energyLevel}%` }}
                    />
                  </div>
                  <span className="text-gray-300 font-mono w-8 text-right">{data.sonicDNA.energyLevel}</span>
                </div>
              </div>
            )}
            {data.sonicDNA.danceability != null && (
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-gray-500">Danceability</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink-500 rounded-full"
                      style={{ width: `${data.sonicDNA.danceability}%` }}
                    />
                  </div>
                  <span className="text-gray-300 font-mono w-8 text-right">{data.sonicDNA.danceability}</span>
                </div>
              </div>
            )}
            {data.sonicDNA.atmosphere && <InfoRow label="Atmosphere" value={data.sonicDNA.atmosphere} />}
            {data.sonicDNA.tempoFeel && <InfoRow label="Tempo Feel" value={data.sonicDNA.tempoFeel} />}
            {data.sonicDNA.eraVibe && <InfoRow label="Era Vibe" value={data.sonicDNA.eraVibe} />}
          </Section>

          {/* Content DNA */}
          {data.fingerprint && (
            <Section title="Content DNA" icon={<Fingerprint className="w-3.5 h-3.5" />}>
              <InfoRow label="Waveform Hash" value={data.fingerprint.waveformHash} mono />
              <InfoRow label="AI Fingerprint" value={data.fingerprint.aiFingerprint} mono />
              {data.fingerprint.detectedBpm && (
                <InfoRow label="Detected BPM" value={String(data.fingerprint.detectedBpm)} />
              )}
              {data.fingerprint.detectedKey && (
                <InfoRow label="Detected Key" value={data.fingerprint.detectedKey} />
              )}
            </Section>
          )}

          {/* AI Provenance */}
          {data.generationModel && (
            <Section title="AI Provenance" icon={<Eye className="w-3.5 h-3.5" />}>
              <InfoRow label="Model" value={data.generationModel} />
              <InfoRow
                label="Prompt"
                value={data.promptVisibility === 'public' ? 'Public' : 'Private'}
                icon={data.promptVisibility === 'public'
                  ? <Eye className="w-3 h-3 text-blue-400" />
                  : <EyeOff className="w-3 h-3 text-gray-500" />
                }
              />
            </Section>
          )}

          {/* Lineage */}
          {data.lineage && data.lineage.length > 0 && (
            <Section title="Ownership Lineage" icon={<Link2 className="w-3.5 h-3.5" />}>
              <div className="space-y-1">
                {data.lineage.slice(0, 5).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <span className="text-gray-400 capitalize">{entry.transaction_type.replace('_', ' ')}</span>
                    <span className="text-gray-600 text-[10px]">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Release Strength */}
          <MetadataStrengthMeter trackId={trackId} initialScore={data.metadataStrength} />

          {/* User Permissions */}
          {data.currentUserPermissions && (
            <div className="text-xs text-gray-600 space-y-1">
              {data.currentUserPermissions.isOriginalCreator && (
                <p className="text-purple-400">✦ You are the original creator</p>
              )}
              {!data.currentUserPermissions.isOriginalCreator && (
                <p>
                  Remix: {data.currentUserPermissions.canRemix
                    ? <span className="text-green-400">Allowed</span>
                    : <span className="text-red-400">{data.currentUserPermissions.remixReason}</span>
                  }
                </p>
              )}
            </div>
          )}

          {/* Signature */}
          <p className="text-[10px] text-gray-600 font-mono text-center pt-2 border-t border-gray-800">
            {data.mintedOn}
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-400">{icon}</span>
        <span className="text-xs font-medium text-gray-300">{title}</span>
      </div>
      <div className="pl-5 space-y-0.5">{children}</div>
    </div>
  )
}

function InfoRow({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={`text-gray-300 ${mono ? 'font-mono text-[10px]' : ''}`}>{value}</span>
      </div>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function formatCreationType(type: string): string {
  const map: Record<string, string> = {
    ai_generated: 'AI Generated',
    ai_assisted: 'AI Assisted',
    human_upload: 'Human Upload',
    remix_444: 'Remix',
    stem_derivative: 'Stem',
  }
  return map[type] || type || 'Unknown'
}

function getCreationTypeBadge(type: string): string {
  const map: Record<string, string> = {
    ai_generated: 'bg-blue-500/20 text-blue-400',
    ai_assisted: 'bg-cyan-500/20 text-cyan-400',
    human_upload: 'bg-green-500/20 text-green-400',
    remix_444: 'bg-orange-500/20 text-orange-400',
    stem_derivative: 'bg-purple-500/20 text-purple-400',
  }
  return map[type] || 'bg-gray-500/20 text-gray-400'
}

function formatLicense(license: string): string {
  const map: Record<string, string> = {
    fully_ownable: 'Fully Ownable',
    non_exclusive: 'Non-Exclusive',
    remix_allowed: 'Remix Allowed',
    download_only: 'Download Only',
    streaming_only: 'Streaming Only',
    no_derivatives: 'No Derivatives',
  }
  return map[license] || license || 'Fully Ownable'
}
