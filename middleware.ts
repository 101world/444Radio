import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/webhooks/paypal(.*)', // PayPal subscription webhooks
  '/api/webhooks/razorpay(.*)', // Razorpay subscription webhooks
  '/api/razorpay-webhook(.*)', // Alternative Razorpay webhook path
  '/api/cron/(.*)',
  '/api/media/track-play',
  '/api/songs/track-play',
  '/api/media/explore(.*)',
  '/api/explore/genre-summary(.*)',
  '/api/plugin/(.*)',  // Plugin API uses Bearer token auth, not Clerk sessions
  '/plugin',           // Plugin WebView page (auth via token, not Clerk)
  '/manifest.json',
  '/explore',
  '/sitemap.xml',
  '/robots.txt',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}