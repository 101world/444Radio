/**
 * Chat Service Layer
 *
 * Shared logic for chat message CRUD used by:
 *   - /api/chat/messages  (Clerk auth — website)
 *   - /api/plugin/chat    (Bearer token — VST3 plugin)
 *
 * Single source of truth: Supabase `chat_messages` table.
 * localStorage on the client is an offline cache, NOT the authority.
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ── Constants ──
export const MSG_COLS =
  'id, message_type, content, generation_type, generation_id, result, timestamp' as const
export const MAX_BULK_MESSAGES = 500

// ── Types ──
export interface ChatMessageRow {
  id: string
  message_type: string
  content: string
  generation_type: string | null
  generation_id: string | null
  result: Record<string, unknown> | null
  timestamp: string
}

export interface ChatMessageClient {
  id: string
  type: string
  content: string
  generationType?: string | null
  generationId?: string | null
  result?: Record<string, unknown> | null
  stems?: Record<string, string>
  timestamp: Date | string
  isGenerating: boolean
}

export interface ChatInsertPayload {
  type: string
  content: string
  generationType?: string | null
  generationId?: string | null
  result?: Record<string, unknown> | null
  stems?: Record<string, string>
  timestamp?: string
}

// ── Transform DB row → client shape ──
export function transformRow(row: ChatMessageRow): ChatMessageClient {
  const result = row.result as Record<string, unknown> | null
  const stems = (result?._stems as Record<string, string>) ?? undefined
  // Strip _stems from result so it doesn't leak to generic result display
  const cleanResult = result ? { ...result } : null
  if (cleanResult) delete cleanResult._stems

  return {
    id: row.id,
    type: row.message_type,
    content: row.content,
    generationType: row.generation_type,
    generationId: row.generation_id,
    result: cleanResult && Object.keys(cleanResult).length > 0 ? cleanResult : undefined,
    stems,
    timestamp: new Date(row.timestamp),
    isGenerating: false,
  }
}

// ── Build a DB insert row from a client payload ──
export function toInsertRow(
  userId: string,
  msg: ChatInsertPayload
): Record<string, unknown> {
  // Merge stems into result JSONB so they survive round-trip
  const resultData: Record<string, unknown> | null =
    msg.result ?? (msg.stems ? {} : null)
  if (msg.stems && resultData) {
    resultData._stems = msg.stems
  }

  return {
    clerk_user_id: userId,
    message_type: msg.type,
    content: msg.content,
    generation_type: msg.generationType ?? null,
    generation_id: msg.generationId ?? null,
    result: resultData,
    timestamp: msg.timestamp || new Date().toISOString(),
  }
}

// ── Query helpers ──

interface FetchOptions {
  limit?: number
  before?: string | null   // ISO cursor (older than)
  after?: string | null     // ISO cursor (newer than) — for delta sync
}

export async function fetchMessages(
  db: SupabaseClient,
  userId: string,
  opts: FetchOptions = {}
) {
  const limit = Math.min(opts.limit ?? 200, 500)

  let query = db
    .from('chat_messages')
    .select(MSG_COLS)
    .eq('clerk_user_id', userId)
    .order('timestamp', { ascending: true })
    .limit(limit)

  if (opts.before) query = query.lt('timestamp', opts.before)
  if (opts.after) query = query.gt('timestamp', opts.after)

  const { data, error } = await query
  return { data: data as ChatMessageRow[] | null, error, hasMore: (data?.length ?? 0) === limit }
}

export async function insertMessage(
  db: SupabaseClient,
  userId: string,
  msg: ChatInsertPayload
) {
  const row = toInsertRow(userId, msg)
  const { data, error } = await db
    .from('chat_messages')
    .insert(row)
    .select(MSG_COLS)
    .single()

  return { data: data as ChatMessageRow | null, error }
}

export async function insertMessages(
  db: SupabaseClient,
  userId: string,
  msgs: ChatInsertPayload[]
) {
  const rows = msgs.map((m) => toInsertRow(userId, m))
  const { error } = await db.from('chat_messages').insert(rows)
  return { error }
}

export async function deleteAllMessages(db: SupabaseClient, userId: string) {
  const { error } = await db
    .from('chat_messages')
    .delete()
    .eq('clerk_user_id', userId)
  return { error }
}

export async function updateMessage(
  db: SupabaseClient,
  userId: string,
  messageId: string,
  patch: Partial<ChatInsertPayload>
) {
  const updates: Record<string, unknown> = {}
  if (patch.content !== undefined) updates.content = patch.content
  if (patch.type !== undefined) updates.message_type = patch.type
  if (patch.generationType !== undefined) updates.generation_type = patch.generationType
  if (patch.generationId !== undefined) updates.generation_id = patch.generationId
  if (patch.result !== undefined) {
    const resultData = { ...patch.result }
    if (patch.stems) (resultData as Record<string, unknown>)._stems = patch.stems
    updates.result = resultData
  }

  const { data, error } = await db
    .from('chat_messages')
    .update(updates)
    .eq('id', messageId)
    .eq('clerk_user_id', userId) // ownership check
    .select(MSG_COLS)
    .single()

  return { data: data as ChatMessageRow | null, error }
}

/**
 * Bulk sync (PUT) — delete + insert with rollback safety.
 * Only used for plugin full-sync or legacy compat.
 */
export async function bulkReplace(
  db: SupabaseClient,
  userId: string,
  msgs: ChatInsertPayload[]
) {
  if (msgs.length > MAX_BULK_MESSAGES) {
    return { error: { message: `Max ${MAX_BULK_MESSAGES} messages per sync` }, rolledBack: false }
  }

  // Build rows first (fail fast on bad data)
  const rows = msgs.map((m) => toInsertRow(userId, m))

  // Snapshot for rollback
  const { data: backup } = await db
    .from('chat_messages')
    .select(MSG_COLS)
    .eq('clerk_user_id', userId)

  // Delete existing
  const { error: deleteError } = await db
    .from('chat_messages')
    .delete()
    .eq('clerk_user_id', userId)

  if (deleteError) return { error: deleteError, rolledBack: false }

  // Insert new
  if (rows.length > 0) {
    const { error: insertError } = await db.from('chat_messages').insert(rows)
    if (insertError) {
      // Rollback
      if (backup && backup.length > 0) {
        await db.from('chat_messages').insert(backup)
      }
      return { error: insertError, rolledBack: true }
    }
  }

  return { error: null, rolledBack: false }
}
