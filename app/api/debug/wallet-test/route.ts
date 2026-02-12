import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'

export async function OPTIONS() {
  return handleOptions()
}

/**
 * GET /api/debug/wallet-test
 *
 * Tests the full wallet pipeline:
 *   1. Checks env vars are present
 *   2. Tries to SELECT from credit_transactions
 *   3. Tries to INSERT a test transaction (amount=0, type='other', status='pending')
 *   4. Tries to SELECT it back
 *   5. Deletes the test row
 *
 * Visit this URL in the browser to diagnose why wallet is empty.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const results: Record<string, unknown> = { userId, timestamp: new Date().toISOString() }

  // 1. Check env vars
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  results.envVars = {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : '❌ MISSING',
    SUPABASE_SERVICE_ROLE_KEY: supabaseKey ? `${supabaseKey.substring(0, 10)}...${supabaseKey.substring(supabaseKey.length - 4)}` : '❌ MISSING',
  }

  if (!supabaseUrl || !supabaseKey) {
    results.error = 'Missing env vars — cannot proceed'
    return corsResponse(NextResponse.json(results))
  }

  const headers = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  }

  // 2. SELECT existing transactions for this user
  try {
    const selectRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions?user_id=eq.${userId}&order=created_at.desc&limit=5`,
      { headers }
    )
    const selectStatus = selectRes.status
    const selectBody = await selectRes.text()
    results.existingTransactions = {
      status: selectStatus,
      ok: selectRes.ok,
      body: selectStatus === 200 ? JSON.parse(selectBody) : selectBody,
      count: selectStatus === 200 ? JSON.parse(selectBody).length : 0,
    }
  } catch (err) {
    results.existingTransactions = { error: String(err) }
  }

  // 3. Count ALL transactions for this user
  try {
    const countRes = await fetch(
      `${supabaseUrl}/rest/v1/credit_transactions?user_id=eq.${userId}&select=count`,
      {
        headers: {
          ...headers,
          'Prefer': 'count=exact',
        },
      }
    )
    const countBody = await countRes.text()
    results.totalTransactionCount = {
      status: countRes.status,
      body: countRes.ok ? JSON.parse(countBody) : countBody,
      contentRange: countRes.headers.get('content-range'),
    }
  } catch (err) {
    results.totalTransactionCount = { error: String(err) }
  }

  // 4. Try INSERT a test transaction
  const testId = `test-${Date.now()}`
  try {
    const insertBody = {
      user_id: userId,
      amount: 0,
      balance_after: null,
      type: 'other',
      status: 'pending',
      description: `[DEBUG TEST] wallet-test ${testId}`,
      metadata: { debug: true, testId },
    }

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/credit_transactions`, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(insertBody),
    })

    const insertStatus = insertRes.status
    const insertResponseBody = await insertRes.text()
    results.testInsert = {
      status: insertStatus,
      ok: insertRes.ok,
      body: insertStatus >= 200 && insertStatus < 300 ? JSON.parse(insertResponseBody) : insertResponseBody,
      sentBody: insertBody,
    }

    // 5. If insert succeeded, clean up
    if (insertRes.ok) {
      const inserted = JSON.parse(insertResponseBody)
      const rowId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id
      if (rowId) {
        const deleteRes = await fetch(
          `${supabaseUrl}/rest/v1/credit_transactions?id=eq.${rowId}`,
          {
            method: 'DELETE',
            headers,
          }
        )
        results.testCleanup = { deleted: deleteRes.ok, status: deleteRes.status }
      }
    }
  } catch (err) {
    results.testInsert = { error: String(err) }
  }

  // 6. Also test the wallet/transactions endpoint internally
  results.summary = {
    envVarsOk: !!(supabaseUrl && supabaseKey),
    tableReadable: (results.existingTransactions as any)?.ok === true,
    tableWritable: (results.testInsert as any)?.ok === true,
    existingCount: (results.totalTransactionCount as any)?.body?.[0]?.count ?? (results.existingTransactions as any)?.count ?? 'unknown',
  }

  return corsResponse(NextResponse.json(results, { status: 200 }))
}
