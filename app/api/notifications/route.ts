import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { corsResponse, handleOptions } from '@/lib/cors';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path: string, options?: RequestInit) {
  if (!SB_URL || !SB_KEY) {
    throw new Error('Missing Supabase environment variables for notifications endpoint');
  }

  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options?.headers || {}),
    },
  });
  return res;
}

function encodeEq(value: string) {
  return encodeURIComponent(value);
}

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      // Keep endpoint non-failing for UI; unauthenticated users just get an empty list.
      return corsResponse(NextResponse.json({ notifications: [] }));
    }

    if (!SB_URL || !SB_KEY) {
      console.error('[notifications] Missing Supabase environment variables');
      return corsResponse(NextResponse.json({ notifications: [] }));
    }

    // Some environments may have notifications.user_id (legacy) or notifications.clerk_user_id.
    // Try both. If both fail, return an empty list (do not break the bell UI with 500s).
    const userIdEq = encodeEq(userId);
    const queries = [
      `notifications?user_id=eq.${userIdEq}&order=created_at.desc&limit=50`,
      `notifications?clerk_user_id=eq.${userIdEq}&order=created_at.desc&limit=50`,
    ];

    let rows: any[] = [];
    let matchedColumn: 'user_id' | 'clerk_user_id' | null = null;
    let lastErrorDetail = '';

    for (const query of queries) {
      const res = await sb(query);
      if (res.ok) {
        const json = await res.json().catch(() => []);
        rows = Array.isArray(json) ? json : [];
        matchedColumn = query.includes('clerk_user_id=') ? 'clerk_user_id' : 'user_id';
        lastErrorDetail = '';
        break;
      }

      lastErrorDetail = await res.text().catch(() => '');
    }

    if (lastErrorDetail) {
      console.error('[notifications] Query failed, returning empty list:', lastErrorDetail);
    } else {
      console.log(`[notifications] Fetched using column: ${matchedColumn ?? 'unknown'}`);
    }

    const notifications = rows.map((n: any) => ({
      id: n.id,
      title: n.title || (n.type ? `${String(n.type).charAt(0).toUpperCase()}${String(n.type).slice(1)} update` : 'Notification'),
      body: n.body || n.message || n.data?.message || undefined,
      unread: !n.read_at,
      created_at: n.created_at,
      type: n.type,
      data: n.data,
    }));

    return corsResponse(NextResponse.json({ notifications }));
  } catch (error) {
    console.error('[notifications] Unexpected error:', error);
    return corsResponse(NextResponse.json({ notifications: [] }));
  }
}
