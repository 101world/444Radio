import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { corsResponse, handleOptions } from '@/lib/cors';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function sb(path: string, options?: RequestInit) {
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

export async function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return corsResponse(NextResponse.json({ notifications: [] }, { status: 401 }));
  }
  const res = await sb(`notifications?user_id=eq.${userId}&order=created_at.desc&limit=50`);
  if (!res.ok) {
    return corsResponse(NextResponse.json({ notifications: [] }, { status: 500 }));
  }
  const notifications = await res.json();
  return corsResponse(NextResponse.json({ notifications }));
}
