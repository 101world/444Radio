import { NextRequest, NextResponse } from 'next/server'

/**
 * PayPal Webhook Handler — DISABLED
 * 
 * PayPal subscription system has been replaced by Razorpay wallet integration.
 * This endpoint now rejects all events to prevent stale subscriptions
 * from granting free credits.
 * 
 * Disabled: 2026-02-17
 */

export async function POST(req: NextRequest) {
  console.log('⛔ PayPal webhook received but DISABLED — all payments go through Razorpay now')
  
  try {
    const body = await req.json()
    console.log('⛔ Rejected PayPal event:', body.event_type, '| Event ID:', body.id)
  } catch { /* ignore parse errors */ }

  // Return 200 so PayPal stops retrying, but do nothing
  return NextResponse.json({ 
    success: true,
    message: 'PayPal integration disabled — use Razorpay',
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, paypal-auth-algo, paypal-cert-url, paypal-transmission-id, paypal-transmission-sig, paypal-transmission-time'
    }
  })
}
