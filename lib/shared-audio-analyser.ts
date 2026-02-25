/**
 * Shared Audio Analyser — ensures only ONE AudioContext + MediaElementAudioSourceNode
 * per HTMLAudioElement, then fans out to multiple AnalyserNode consumers.
 *
 * Problem: createMediaElementSource() can only be called once per audio element.
 * If multiple visualizer components each try to create their own source, only the
 * first succeeds and the rest silently fail (→ no frequency data → visualizer dead).
 *
 * Solution: This module caches the source and AudioContext per audio element,
 * and creates a fresh AnalyserNode for each consumer (all fed from the same source).
 */

let sharedCtx: AudioContext | null = null
let sharedSource: MediaElementAudioSourceNode | null = null
let connectedElement: HTMLAudioElement | null = null

/**
 * Get (or create) an AnalyserNode connected to the given audio element.
 * Each call returns a NEW AnalyserNode, but they all share the same
 * AudioContext and MediaElementAudioSourceNode.
 */
export function getSharedAnalyser(
  audioElement: HTMLAudioElement,
  options?: { fftSize?: number; smoothing?: number }
): AnalyserNode | null {
  try {
    // Create AudioContext once
    if (!sharedCtx || sharedCtx.state === 'closed') {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      sharedCtx = new Ctx()
    }

    // Resume if suspended (autoplay policy)
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {})
    }

    // Create MediaElementSource ONCE per audio element
    if (connectedElement !== audioElement) {
      try {
        sharedSource = sharedCtx.createMediaElementSource(audioElement)
        sharedSource.connect(sharedCtx.destination) // Route audio to speakers
        connectedElement = audioElement
      } catch {
        // Already connected in this context — recover gracefully.
        // This can happen if the audio element was previously connected in the same context.
        console.warn('[SharedAnalyser] Could not create source — element may already be connected')
        if (!sharedSource) return null
      }
    }

    if (!sharedSource) return null

    // Create fresh AnalyserNode for this consumer
    const analyser = sharedCtx.createAnalyser()
    analyser.fftSize = options?.fftSize ?? 256
    analyser.smoothingTimeConstant = options?.smoothing ?? 0.65

    // Connect source → analyser (analyser is a pass-through tap, doesn't block audio)
    sharedSource.connect(analyser)

    return analyser
  } catch (err) {
    console.warn('[SharedAnalyser] Setup failed:', err)
    return null
  }
}

/**
 * Disconnect an AnalyserNode previously obtained from getSharedAnalyser.
 * Safe to call even if not connected.
 */
export function disconnectAnalyser(analyser: AnalyserNode | null) {
  if (!analyser) return
  try {
    if (sharedSource) sharedSource.disconnect(analyser)
  } catch {
    // Already disconnected
  }
}
