import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { corsResponse, handleOptions } from '@/lib/cors'
import { logCreditTransaction } from '@/lib/credit-transactions'
import { ADMIN_CLERK_ID } from '@/lib/constants'
import { supabase } from '@/lib/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ADMIN_EMAIL = '444radioog@gmail.com'

async function supabaseRest(path: string, options?: RequestInit) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options?.headers || {}),
    },
  })
  return res
}

export async function OPTIONS() {
  return handleOptions()
}

const LISTING_FEE = 2

/**
 * List a track on the EARN marketplace.
 *
 * Pricing model:
 *   - Listing costs 2 credits — one-time fee paid to 444 Radio admin.
 *   - Artist must own the track.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  try {
    const { trackId } = await request.json()

    if (!trackId) {
      return corsResponse(NextResponse.json({ error: 'trackId required' }, { status: 400 }))
    }

    // 1. Verify user owns the track
    // Try with listed_on_earn column first, fall back without it if column doesn't exist yet
    let trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,user_id,listed_on_earn`)
    let tracks: any[]
    if (!trackRes.ok) {
      // Column probably doesn't exist yet — query without it
      trackRes = await supabaseRest(`combined_media?id=eq.${trackId}&user_id=eq.${userId}&select=id,title,user_id`)
      tracks = await trackRes.json()
    } else {
      tracks = await trackRes.json()
    }
    const track = tracks?.[0]

    if (!track) {
      return corsResponse(NextResponse.json({ error: 'Track not found or you do not own it' }, { status: 404 }))
    }

    if (track.listed_on_earn) {
      return corsResponse(NextResponse.json({ error: 'Track is already listed' }, { status: 400 }))
    }

    // Prevent re-listing tracks purchased from Earn (unethical)
    try {
      const purchaseCheck = await supabaseRest(`earn_purchases?buyer_id=eq.${userId}&track_id=eq.${trackId}&select=id`)
      if (purchaseCheck.ok) {
        const purch = await purchaseCheck.json()
        if (purch && purch.length > 0) {
          return corsResponse(NextResponse.json({ error: 'Cannot list a track you purchased from the marketplace. Purchased tracks are for personal use only.' }, { status: 403 }))
        }
      }
    } catch { /* table may not exist yet — allow */ }

    // 2. Atomically deduct listing fee via RPC (prevents race conditions)
    const deductRes = await supabaseRest('rpc/deduct_credits', {
      method: 'POST',
      body: JSON.stringify({
        p_clerk_user_id: userId,
        p_amount: LISTING_FEE,
        p_type: 'earn_list',
        p_description: `Listed track on Earn`,
        p_metadata: { trackId },
      }),
    })
    if (!deductRes.ok) {
      return corsResponse(NextResponse.json({ error: 'Failed to deduct listing fee' }, { status: 500 }))
    }
    const deductRows = await deductRes.json()
    const deductRow = deductRows?.[0]
    if (!deductRow?.success) {
      const msg = deductRow?.error_message || 'Insufficient credits'
      const status = msg.includes('Insufficient') ? 402 : msg.includes('not found') ? 404 : 500
      return corsResponse(NextResponse.json({ error: msg === 'Insufficient credits' ? `You need at least ${LISTING_FEE} credits to list a track` : msg }, { status }))
    }
    const newUserCredits = deductRow.new_credits

    // Log lister's deduction
    await logCreditTransaction({ userId, amount: -LISTING_FEE, balanceAfter: newUserCredits, type: 'earn_list', description: `Listed track on Earn (${LISTING_FEE} credits)`, metadata: { trackId } })

    // 3. Fetch admin account to credit
    let admin: any = null

    // Try by clerk_user_id first (most reliable)
    if (ADMIN_CLERK_ID) {
      const adminRes = await supabaseRest(`users?clerk_user_id=eq.${ADMIN_CLERK_ID}&select=clerk_user_id,credits`)
      if (adminRes.ok) {
        const admins = await adminRes.json()
        admin = admins?.[0]
      }
    }

    // Fall back to email lookup
    if (!admin) {
      const adminRes = await supabaseRest(`users?email=eq.${encodeURIComponent(ADMIN_EMAIL)}&select=clerk_user_id,credits`)
      if (adminRes.ok) {
        const admins = await adminRes.json()
        admin = admins?.[0]
      }
    }

    if (!admin) {
      console.warn('Admin account not found — listing will still proceed but admin will not be credited')
    }

    // 4. Credit admin using award_credits() RPC (transaction logging automatic)
    // Note: lister deduction already done atomically above via deduct_credits RPC
    if (admin) {
      const adminCreditResult = await supabase.rpc('award_credits', {
        p_clerk_user_id: admin.clerk_user_id,
        p_amount: LISTING_FEE,
        p_type: 'earn_admin',
        p_description: `Listing fee received for: ${trackId}`,
        p_metadata: { trackId, listerId: userId }
      })

      if (adminCreditResult.error) {
        console.error('Failed to credit admin:', adminCreditResult.error)
        // Refund lister atomically — add credits back
        await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ credits: newUserCredits + LISTING_FEE }),
        })
        return corsResponse(NextResponse.json({ error: 'Failed to credit platform — rolled back' }, { status: 500 }))
      }
    }

    // 5. Credit transactions already logged by RPCs
    // (lister deduction logged by deduct_credits RPC, admin credits logged by award_credits RPC)

    // 6b. Enrich the track with release metadata if missing
    //     The release flow creates a SEPARATE combined_media record with full metadata.
    //     Look for a sibling record (same audio_url, same user) that has genre set.
    let metadataPatch: Record<string, unknown> = {}
    try {
      // First, get this track's audio_url and check if it already has metadata
      const thisTrackRes = await supabaseRest(`combined_media?id=eq.${trackId}&select=audio_url,genre,mood,bpm,key_signature,vocals,language,description,instruments,tags,secondary_genre,is_explicit,duration_seconds,artist_name,featured_artists,contributors,songwriters,copyright_holder,copyright_year,record_label,publisher,release_type,version_tag,image_url,video_url`)
      if (thisTrackRes.ok) {
        const thisTrackArr = await thisTrackRes.json()
        const thisTrack = thisTrackArr?.[0]
        if (thisTrack && !thisTrack.genre && thisTrack.audio_url) {
          // Look for a released sibling with metadata (same audio_url, same user, has genre)
          const siblingRes = await supabaseRest(
            `combined_media?audio_url=eq.${encodeURIComponent(thisTrack.audio_url)}&user_id=eq.${userId}&genre=not.is.null&id=not.eq.${trackId}&select=genre,mood,bpm,key_signature,vocals,language,description,instruments,tags,secondary_genre,is_explicit,duration_seconds,artist_name,featured_artists,contributors,songwriters,copyright_holder,copyright_year,record_label,publisher,release_type,version_tag,image_url,video_url&limit=1`
          )
          if (siblingRes.ok) {
            const siblings = await siblingRes.json()
            const sibling = siblings?.[0]
            if (sibling) {
              // Build patch from non-null sibling fields (only fill gaps)
              const fieldsToMerge = [
                'genre', 'mood', 'bpm', 'key_signature', 'vocals', 'language',
                'description', 'instruments', 'tags', 'secondary_genre', 'is_explicit',
                'duration_seconds', 'artist_name', 'featured_artists', 'contributors',
                'songwriters', 'copyright_holder', 'copyright_year', 'record_label',
                'publisher', 'release_type', 'version_tag'
              ]
              for (const f of fieldsToMerge) {
                if (sibling[f] != null && thisTrack[f] == null) {
                  metadataPatch[f] = sibling[f]
                }
              }
              // Also fill image_url if the listed record has none
              if (sibling.image_url && !thisTrack.image_url) {
                metadataPatch.image_url = sibling.image_url
              }
              // Also fill video_url (visualizer) if the listed record has none
              if (sibling.video_url && !thisTrack.video_url) {
                metadataPatch.video_url = sibling.video_url
              }
              console.log(`[EARN-LIST] Merged ${Object.keys(metadataPatch).length} metadata fields from released sibling`)
            }
          }
        }
      }
    } catch (e) {
      console.warn('[EARN-LIST] Metadata merge failed (non-critical):', e)
    }

    // 7. Mark track as listed on earn marketplace (+ merged metadata)
    const updateRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        listed_on_earn: true,
        earn_price: 5,
        artist_share: 1,
        admin_share: 4,
        ...metadataPatch,
      }),
    })

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => 'unknown')
      console.warn('Earn columns PATCH failed (columns may not exist yet):', errText)
      // Fallback: set is_public so the track still appears
      const fallbackRes = await supabaseRest(`combined_media?id=eq.${trackId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_public: true }),
      })
      if (!fallbackRes.ok) {
        // Rollback credit operations (refund listing fee)
        await supabaseRest(`users?clerk_user_id=eq.${userId}`, {
          method: 'PATCH',
          body: JSON.stringify({ credits: newUserCredits + LISTING_FEE }),
        })
        if (admin) {
          await supabaseRest(`users?clerk_user_id=eq.${admin.clerk_user_id}`, {
            method: 'PATCH',
            body: JSON.stringify({ credits: admin.credits }),
          })
        }
        return corsResponse(NextResponse.json({ error: 'Failed to list track — rolled back' }, { status: 500 }))
      }
    }

    // 7. Record the listing fee transaction (best-effort — table may not exist yet)
    try {
      const txRes = await supabaseRest('earn_transactions', {
        method: 'POST',
        body: JSON.stringify({
          buyer_id: userId,
          seller_id: admin?.clerk_user_id || 'admin_not_found',
          admin_id: admin?.clerk_user_id || null,
          track_id: trackId,
          total_cost: LISTING_FEE,
          artist_share: 0,
          admin_share: LISTING_FEE,
          split_stems: false,
        }),
      })
      if (!txRes.ok) {
        console.warn('earn_transactions insert failed (table may not exist yet):', await txRes.text().catch(() => ''))
      }
    } catch (e) {
      console.error('Failed to record listing transaction:', e)
    }

    // Quest progress: fire-and-forget
    const { trackQuestProgress } = await import('@/lib/quest-progress')
    trackQuestProgress(userId, 'upload_marketplace').catch(() => {})

    return corsResponse(NextResponse.json({
      success: true,
      message: `"${track.title}" is now listed on the EARN marketplace`,
      creditsDeducted: LISTING_FEE,
    }))

  } catch (error: any) {
    console.error('List track error:', error?.message || error)
    return corsResponse(NextResponse.json({ 
      error: 'Failed to list track', 
      detail: error?.message || String(error) 
    }, { status: 500 }))
  }
}
