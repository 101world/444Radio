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

    // Resume if suspended (autoplay policy) — this is critical.
    // Don't block on it; the analyser will start getting data once resumed.
    if (sharedCtx.state === 'suspended') {
      sharedCtx.resume().catch(() => {})
    }

    // Create MediaElementSource ONCE per audio element.
    // After this call the audio element's output is routed through the Web Audio graph
    // instead of directly to speakers, so we MUST connect source → destination.
    if (connectedElement !== audioElement) {
      // If we previously connected a different element, disconnect old source
      if (sharedSource) {
        try { sharedSource.disconnect() } catch { /* ignore */ }
        sharedSource = null
      }

      try {
        sharedSource = sharedCtx.createMediaElementSource(audioElement)
        sharedSource.connect(sharedCtx.destination) // Route audio to speakers
        connectedElement = audioElement
      } catch {
        // Element may already be connected to THIS context (e.g. hot-reload).
        // In that case connectedElement was stale but the source is still valid.
        console.warn('[SharedAnalyser] createMediaElementSource failed — element may already be connected')
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
 * Ensure the AudioContext is resumed (call on user interaction).
 * Returns a promise that resolves when the context is running.
 */
export async function ensureAudioContextResumed(): Promise<void> {
  if (sharedCtx && sharedCtx.state === 'suspended') {
    await sharedCtx.resume()
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
