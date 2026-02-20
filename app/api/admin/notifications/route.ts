import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_CLERK_ID } from '@/lib/constants'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(req: NextRequest) {
  try {
    // ── Auth: Admin only ──
    const { userId } = await auth()
    if (!userId || userId !== ADMIN_CLERK_ID) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const unreadOnly = searchParams.get('unread') === 'true'
    const category = searchParams.get('category') // 'credits', 'users', 'revenue', 'system'

    let query = supabase
      .from('admin_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data: notifications, error } = await query

    if (error) {
      console.error('Error fetching admin notifications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch notifications' },
        { status: 500 }
      )
    }

    // Get summary stats
    const { data: summaryData } = await supabase
      .from('admin_notifications')
      .select('is_read, category')

    const unreadCount = summaryData?.filter(n => !n.is_read).length || 0
    const byCategoryCount = summaryData?.reduce((acc: Record<string, number>, n) => {
      acc[n.category] = (acc[n.category] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      summary: {
        total: summaryData?.length || 0,
        unread: unreadCount,
        byCategory: byCategoryCount || {}
      }
    })
  } catch (error) {
    console.error('Admin notifications API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // ── Auth: Admin only ──
    const { userId } = await auth()
    if (!userId || userId !== ADMIN_CLERK_ID) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { id, is_read } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: is_read || true })
      .eq('id', id)

    if (error) {
      console.error('Error updating notification:', error)
      return NextResponse.json(
        { error: 'Failed to update notification' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin notifications API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Mark all as read
export async function POST(req: NextRequest) {
  try {
    // ── Auth: Admin only ──
    const { userId } = await auth()
    if (!userId || userId !== ADMIN_CLERK_ID) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('admin_notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    if (error) {
      console.error('Error marking notifications as read:', error)
      return NextResponse.json(
        { error: 'Failed to update notifications' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin notifications API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
