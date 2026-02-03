import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook(.*)',
  '/api/webhooks/paypal(.*)', // PayPal subscription webhooks
  '/api/cron/(.*)',
  '/api/media/track-play',
  '/api/songs/track-play',
  '/api/media/explore(.*)',
  '/api/explore/genre-summary(.*)',
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