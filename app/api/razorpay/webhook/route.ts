// ─────────────────────────────────────────────────────────────
// DEPRECATED: Razorpay webhooks consolidated to /api/webhooks/razorpay
// This stub forwards any stale webhook traffic to the canonical handler.
// Once Razorpay dashboard is updated, this file can be deleted.
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Re-dispatch to the canonical handler
  const canonicalUrl = new URL('/api/webhooks/razorpay', req.url)

  console.warn('[Razorpay/old] Forwarding to canonical /api/webhooks/razorpay')

  const forwarded = await fetch(canonicalUrl.toString(), {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    // @ts-expect-error — Node fetch supports duplex for streaming bodies
    duplex: 'half',
  })

  return new Response(forwarded.body, {
    status: forwarded.status,
    headers: forwarded.headers,
  })
}
