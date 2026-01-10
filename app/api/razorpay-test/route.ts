import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  console.log('[TEST] Razorpay test endpoint hit!')
  return NextResponse.json({ success: true, message: 'POST works!' }, { status: 200 })
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST for webhooks' }, { status: 200 })
}
