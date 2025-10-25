import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.05,
    environment: process.env.NODE_ENV || 'development',
    // You can add additional config such as release, integrations, etc.
  })
  console.log('Sentry initialized')
} else {
  // No-op when DSN not provided
  // console.log('Sentry not configured: SENTRY_DSN missing')
}

export default Sentry
