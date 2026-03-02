/**
 * Shared orbit-based AnalyserNode storage for Studio channel LCD visualization.
 * 
 * StudioEditor populates these when playback starts (connecting to per-orbit GainNodes).
 * ChannelLCD reads from them to display real audio waveforms.
 * 
 * This module-level Map avoids prop-threading through the entire component tree.
 */

const orbitAnalysers = new Map<number, AnalyserNode>()

/** Get the AnalyserNode for a specific orbit number */
export function getOrbitAnalyser(orbit: number): AnalyserNode | null {
  return orbitAnalysers.get(orbit) ?? null
}

/** Store an AnalyserNode for a specific orbit */
export function setOrbitAnalyser(orbit: number, node: AnalyserNode): void {
  orbitAnalysers.set(orbit, node)
}

/** Remove all stored orbit analysers (call on stop) */
export function clearOrbitAnalysers(): void {
  orbitAnalysers.clear()
}

/** Get count of stored analysers (for debug logging) */
export function getOrbitAnalyserCount(): number {
  return orbitAnalysers.size
}
