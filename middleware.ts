import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/webhooks/paypal(.*)', // PayPal subscription webhooks
  '/api/webhooks/razorpay(.*)', // Razorpay subscription webhooks
  '/api/referral/lookup(.*)',    // Public referral lookup for sign-up page
  '/api/cron/(.*)',
  '/api/media/track-play',
  '/api/songs/track-play',
  '/api/media/radio(.*)',
  '/api/radio/genre-summary(.*)',
  '/api/plugin/(.*)',  // Plugin API uses Bearer token auth, not Clerk sessions
  '/plugin',           // Plugin WebView page (auth via token, not Clerk)
  '/api/r2/proxy(.*)', // R2 file proxy — must be public so audio downloads work in plugin/DAW
  '/api/generate/atom-(.*)',   // Used by plugin page (hybrid auth: Clerk or Bearer token)
  '/api/generate/prompt-idea', // Used by plugin page (hybrid auth: Clerk or Bearer token)
  '/api/generate/visualizer',  // Uses hybrid auth (Clerk session OR Bearer token)
  '/api/generate/autotune',    // Uses hybrid auth (Clerk session OR Bearer token)
  '/api/storage/upload',       // Used by VisualizerModal (image upload, hybrid auth)
  '/api/upload/media',         // Used by AutotuneModal (audio upload, hybrid auth)
  '/manifest.json',
  '/radio',
  '/creator-v2',               // Creator V2 - no Clerk auth required, dev mode enabled
  '/input',                    // INPUT live-coding editor - no Clerk auth required
  '/sitemap.xml',
  '/robots.txt',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Pass the current pathname to server components via a request header.
  // This lets the root layout render a bare shell for /plugin (DAW WebView).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  return NextResponse.next({
    request: { headers: requestHeaders }
  })
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}