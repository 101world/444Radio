/**
 * WebGL Context Manager
 * Prevents "Too many active WebGL contexts" errors by managing context lifecycle
 */

const MAX_CONTEXTS = 8 // Safe limit for most browsers
const activeContexts: Set<WebGLRenderingContext | WebGL2RenderingContext> = new Set()

/**
 * Register a WebGL context for tracking
 */
export function registerWebGLContext(context: WebGLRenderingContext | WebGL2RenderingContext) {
  // If we're at the limit, force cleanup of oldest context
  if (activeContexts.size >= MAX_CONTEXTS) {
    console.warn('[WebGL] Context limit reached, cleaning up oldest context')
    const firstContext = activeContexts.values().next().value
    if (firstContext) {
      cleanupContext(firstContext)
    }
  }
  
  activeContexts.add(context)
  console.log(`[WebGL] Context registered. Active: ${activeContexts.size}/${MAX_CONTEXTS}`)
}

/**
 * Cleanup and remove a WebGL context
 */
export function cleanupContext(context: WebGLRenderingContext | WebGL2RenderingContext) {
  try {
    // Get the canvas element
    const canvas = context.canvas as HTMLCanvasElement
    
    // Lose the context gracefully
    const loseContextExt = context.getExtension('WEBGL_lose_context')
    if (loseContextExt) {
      loseContextExt.loseContext()
    }
    
    // Remove from tracking
    activeContexts.delete(context)
    
    // Clear canvas
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
    
    console.log(`[WebGL] Context cleaned up. Active: ${activeContexts.size}/${MAX_CONTEXTS}`)
  } catch (error) {
    console.error('[WebGL] Error cleaning up context:', error)
  }
}

/**
 * Cleanup all tracked contexts
 */
export function cleanupAllContexts() {
  console.log('[WebGL] Cleaning up all contexts')
  activeContexts.forEach(context => cleanupContext(context))
  activeContexts.clear()
}

/**
 * Get number of active contexts
 */
export function getActiveContextCount() {
  return activeContexts.size
}

/**
 * React hook for automatic WebGL context cleanup
 */
export function useWebGLContext(contextRef: { current: WebGLRenderingContext | WebGL2RenderingContext | null }) {
  // Register on mount
  if (typeof window !== 'undefined') {
    return () => {
      // Cleanup on unmount
      if (contextRef.current) {
        cleanupContext(contextRef.current)
      }
    }
  }
  return () => {}
}
