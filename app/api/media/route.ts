import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase';
import { corsResponse, handleOptions } from '@/lib/cors';

export async function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return corsResponse(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
    }

    // Fetch user's media from combined_media table
    const { data, error } = await supabase
      .from('combined_media')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return corsResponse(
        NextResponse.json({ error: 'Database error' }, { status: 500 })
      );
    }

    return corsResponse(NextResponse.json(data || []));
  } catch (error) {
    console.error('Media fetch error:', error);
    return corsResponse(
      NextResponse.json({ error: 'Failed to fetch media' }, { status: 500 })
    );
  }
}
