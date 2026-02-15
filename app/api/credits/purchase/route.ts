import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

// ── Wallet Deposit — Create Razorpay Order ──
// Accepts: { amount_usd: number, currency?: 'INR' | 'USD' }
// Charges: amount_usd + 18% GST via Razorpay.
// The pre-GST amount is deposited into wallet_balance by /verify or webhook.
const GST_RATE = 0.18
const INR_RATE = 85

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }

    const user = await currentUser()
    const userEmail = user?.emailAddresses?.[0]?.emailAddress
    if (!userEmail) {
      return corsResponse(
        NextResponse.json({ error: 'Email not found' }, { status: 400 })
      )
    }

    const body = await request.json()
    const amountUsd = parseFloat(body.amount_usd)
    const currency = (body.currency || 'INR') as 'INR' | 'USD'

    // ── Validate ──
    if (!amountUsd || isNaN(amountUsd) || amountUsd < 1 || amountUsd > 500) {
      return corsResponse(
        NextResponse.json({ error: 'Deposit amount must be between $1 and $500' }, { status: 400 })
      )
    }

    // ── Calculate pricing (GST on top) ──
    const gstAmountUsd = amountUsd * GST_RATE
    const totalUsd = amountUsd + gstAmountUsd

    let amountInSmallestUnit: number
    let displayCurrency: string

    if (currency === 'INR') {
      const totalINR = totalUsd * INR_RATE
      amountInSmallestUnit = Math.round(totalINR * 100) // paise
      displayCurrency = 'INR'
    } else {
      amountInSmallestUnit = Math.round(totalUsd * 100) // cents
      displayCurrency = 'USD'
    }

    // Razorpay minimum: 100 paise (₹1) or 50 cents ($0.50)
    const minimum = currency === 'INR' ? 100 : 50
    if (amountInSmallestUnit < minimum) {
      return corsResponse(
        NextResponse.json({ error: 'Amount too small for payment processing' }, { status: 400 })
      )
    }

    const creditEquivalent = Math.floor(amountUsd / 0.035)

    console.log(`[Wallet Deposit] $${amountUsd} for ${userId}: GST=$${gstAmountUsd.toFixed(2)}, total=${displayCurrency} ${(amountInSmallestUnit / 100).toFixed(2)}, ~${creditEquivalent} credits`)

    const keyId = process.env.RAZORPAY_KEY_ID
    const keySecret = process.env.RAZORPAY_KEY_SECRET
    if (!keyId || !keySecret) {
      return corsResponse(
        NextResponse.json({ error: 'Payment configuration error' }, { status: 500 })
      )
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const customerName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.firstName || user.username || userEmail.split('@')[0]

    const shortUserId = userId.slice(-8)
    const timestamp = Date.now().toString().slice(-8)
    const shortReceipt = `wd_${shortUserId}_${timestamp}`

    // ── Create Razorpay Order ──
    const orderPayload = {
      amount: amountInSmallestUnit,
      currency: displayCurrency,
      receipt: shortReceipt,
      notes: {
        clerk_user_id: userId,
        deposit_usd: amountUsd.toFixed(2),
        credit_equivalent: creditEquivalent.toString(),
        purchase_type: 'wallet_deposit',
      }
    }

    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    })

    const order = await orderRes.json()

    if (!orderRes.ok || !order.id) {
      console.error('[Wallet Deposit] Order creation failed:', order)
      return corsResponse(
        NextResponse.json({
          error: order.error?.description || 'Order creation failed',
          details: order.error?.code
        }, { status: 500 })
      )
    }

    console.log('[Wallet Deposit] ✅ Order created:', order.id, `$${amountUsd}`)

    return corsResponse(
      NextResponse.json({
        success: true,
        orderId: order.id,
        amount: amountInSmallestUnit,
        currency: displayCurrency,
        keyId,
        customerName,
        customerEmail: userEmail,
        depositUsd: amountUsd,
        creditEquivalent,
        breakdown: {
          depositUsd: amountUsd,
          gstRate: GST_RATE,
          gstAmount: gstAmountUsd,
          totalCharged: totalUsd,
          creditEquivalent,
          totalDisplay: currency === 'INR'
            ? `₹${(totalUsd * INR_RATE).toFixed(2)}`
            : `$${totalUsd.toFixed(2)}`,
        }
      })
    )
  } catch (error: any) {
    console.error('[Wallet Deposit] Error:', error)
    return corsResponse(
      NextResponse.json({ error: 'Deposit failed', message: error.message }, { status: 500 })
    )
  }
}
