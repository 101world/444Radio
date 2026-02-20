import { NextRequest, NextResponse } from 'next/server'

// DEPRECATED: Use /api/media/explore instead
// This route redirects to the consolidated media API
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const newUrl = url.toString().replace('/api/songs/explore', '/api/media/explore')
  
  console.warn('⚠️ [DEPRECATED] /api/songs/explore called, redirecting to /api/media/explore')
  
  // Fetch from the new endpoint and return the response
  const response = await fetch(newUrl, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
    }
  })
  
  const data = await response.json()
  
  // Transform response to match old format
  return NextResponse.json({
    success: data.success,
    songs: data.combinedMedia || [],
    count: data.combinedMedia?.length || 0
  })
}

