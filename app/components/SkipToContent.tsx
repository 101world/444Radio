'use client'

/**
 * Skip to main content link for keyboard navigation and screen readers
 * Improves accessibility by allowing users to bypass navigation
 */
export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-cyan-500 focus:text-black focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-300"
    >
      Skip to main content
    </a>
  )
}
