/**
 * 444 Radio — Suno API Client
 *
 * Wraps the sunoapi.org REST API for:
 *   - Music generation (Hindi / regional languages in Pro mode)
 *   - Extend (outpaint)
 *   - Replace Section (inpaint)
 *   - Upload & Cover
 *   - Upload & Extend
 *   - Add Vocals
 *   - Add Instrumental (voice-to-melody)
 *   - Generate Persona
 *   - Boost Style
 *   - Credit check
 *   - Task polling
 *
 * Every generation returns **2 tracks**. The caller decides whether to
 * keep both or pick one.
 *
 * Files on Suno expire after 15 days — always download → R2 immediately.
 *
 * All user-facing branding is "444 Radio" — never expose "Suno".
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUNO_BASE = 'https://api.sunoapi.org/api/v1'

function getApiKey(): string {
  const key = process.env.SUNO_API_KEY
  if (!key) throw new Error('SUNO_API_KEY environment variable is not set')
  return key
}

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SunoModel = 'V4' | 'V4_5' | 'V4_5PLUS' | 'V4_5ALL' | 'V5'

export interface SunoGenerateParams {
  /** Text prompt — used as lyrics in custom mode, or idea in non-custom mode */
  prompt: string
  /** Custom mode = full control over style/title/prompt-as-lyrics */
  customMode: boolean
  /** Instrumental only (no vocals) */
  instrumental: boolean
  /** AI model version */
  model: SunoModel
  /** Callback URL (optional — we poll instead) */
  callBackUrl?: string
  /** Music style (required in custom mode) */
  style?: string
  /** Song title (required in custom mode) */
  title?: string
  /** Gender of vocals: 'm' | 'f' */
  vocalGender?: 'm' | 'f'
  /** Tags to exclude */
  negativeTags?: string
  /** Style weight 0-1 */
  styleWeight?: number
  /** Creativity constraint 0-1 */
  weirdnessConstraint?: number
  /** Audio influence weight 0-1 */
  audioWeight?: number
  /** Persona ID (from generate-persona) */
  personaId?: string
  /** Persona model type */
  personaModel?: 'style_persona' | 'voice_persona'
}

export interface SunoExtendParams {
  /** Audio ID from a previous generation */
  audioId: string
  /** Use custom params (true) or original (false) */
  defaultParamFlag: boolean
  model: SunoModel
  callBackUrl?: string
  /** Prompt describing extension */
  prompt?: string
  style?: string
  title?: string
  /** Time in seconds to start extending from */
  continueAt?: number
  vocalGender?: 'm' | 'f'
  negativeTags?: string
  personaId?: string
  personaModel?: 'style_persona' | 'voice_persona'
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
}

export interface SunoReplaceSectionParams {
  /** Original task ID */
  taskId: string
  /** Audio ID */
  audioId: string
  /** Prompt for replacement segment */
  prompt: string
  /** Style tags */
  tags: string
  /** Title */
  title: string
  /** Start time (seconds, 2 decimal places) */
  infillStartS: number
  /** End time (seconds, 2 decimal places) */
  infillEndS: number
  negativeTags?: string
  callBackUrl?: string
}

export interface SunoUploadCoverParams {
  /** Public URL of the audio file to cover */
  uploadUrl: string
  customMode: boolean
  instrumental: boolean
  model: SunoModel
  callBackUrl?: string
  prompt?: string
  style?: string
  title?: string
  vocalGender?: 'm' | 'f'
  negativeTags?: string
  personaId?: string
  personaModel?: 'style_persona' | 'voice_persona'
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
}

export interface SunoUploadExtendParams {
  uploadUrl: string
  defaultParamFlag: boolean
  model: SunoModel
  callBackUrl?: string
  instrumental?: boolean
  prompt?: string
  style?: string
  title?: string
  continueAt?: number
  vocalGender?: 'm' | 'f'
  negativeTags?: string
  personaId?: string
  personaModel?: 'style_persona' | 'voice_persona'
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
}

export interface SunoAddVocalsParams {
  /** Public URL of instrumental audio */
  uploadUrl: string
  prompt: string
  title: string
  style: string
  negativeTags: string
  callBackUrl?: string
  vocalGender?: 'm' | 'f'
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
  model?: 'V4_5PLUS' | 'V5'
}

export interface SunoAddInstrumentalParams {
  /** Public URL of vocal/melody audio */
  uploadUrl: string
  title: string
  tags: string
  negativeTags: string
  callBackUrl?: string
  vocalGender?: 'm' | 'f'
  styleWeight?: number
  weirdnessConstraint?: number
  audioWeight?: number
  model?: 'V4_5PLUS' | 'V5'
}

export interface SunoPersonaParams {
  taskId: string
  audioId: string
  name: string
  description: string
  vocalStart?: number
  vocalEnd?: number
  style?: string
}

export interface SunoBoostStyleParams {
  content: string
}

export interface SunoTaskResponse {
  code: number
  msg: string
  data: {
    taskId: string
  }
}

export interface SunoTrack {
  id: string
  audio_url: string
  stream_audio_url?: string
  title: string
  tags: string
  duration: number
  image_url?: string
  image_large_url?: string
  lyric?: string
  model_name?: string
}

export interface SunoTaskStatus {
  code: number
  msg: string
  data: {
    taskId: string
    status: 'PENDING' | 'GENERATING' | 'SUCCESS' | 'FAILED'
    errorMessage?: string
    response?: {
      data: SunoTrack[]
    }
  }
}

export interface SunoCreditsResponse {
  code: number
  msg: string
  data: number
}

export interface SunoPersonaResponse {
  code: number
  msg: string
  data: {
    personaId: string
    name: string
    description: string
  }
}

export interface SunoBoostStyleResponse {
  code: number
  msg: string
  data: {
    taskId: string
    param: string
    result: string
    creditsConsumed: number
    creditsRemaining: number
    successFlag: string
  }
}

// ---------------------------------------------------------------------------
// 444 Credit Costs (our prices — 50 %+ profit over Suno cost)
//
// Suno charges ~10 credits per generation (~$0.40–0.50 at $0.04–0.05/cr)
// Our rate: $0.035 per 444 credit
//
// Formula: ceil(suno_cost_usd × 1.5 / 0.035)
//   - Generate (10 cr → ~$0.50): $0.75 → 22 credits
//   - Extend   (10 cr → ~$0.50): $0.75 → 22 credits
//   - Inpaint  ( 5 cr → ~$0.25): $0.375 → 11 credits
//   - Cover    (10 cr):                    22 credits
//   - UpExtend (10 cr):                    22 credits
//   - AddVocal (10 cr):                    22 credits
//   - AddInstr (10 cr):                    22 credits
//   - Persona  (FREE):                     0 credits
//   - Boost    (FREE):                     0 credits
//
// Hindi Pro generate is 2 credits (same as standard — user's explicit request).
// ---------------------------------------------------------------------------

export const SUNO_CREDIT_COSTS = {
  generate: 2,         // Hindi / regional Pro music (user keeps same 2 credit cost)
  extend: 22,
  inpaint: 11,
  cover: 22,
  uploadExtend: 22,
  addVocals: 22,
  addInstrumental: 22,
  persona: 0,
  boostStyle: 0,
} as const

// ---------------------------------------------------------------------------
// Helper — generic POST / GET
// ---------------------------------------------------------------------------

async function sunoPost<T = SunoTaskResponse>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${SUNO_BASE}${path}`
  console.log(`[SunoAPI] POST ${path}`)
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || (json.code && json.code !== 200)) {
    const msg = json.msg || json.message || `Suno API error (${res.status})`
    console.error(`[SunoAPI] Error: ${msg}`, json)
    throw new SunoApiError(msg, json.code || res.status)
  }
  return json as T
}

async function sunoGet<T>(path: string): Promise<T> {
  const url = `${SUNO_BASE}${path}`
  console.log(`[SunoAPI] GET ${path}`)
  const res = await fetch(url, { headers: headers() })
  const json = await res.json()
  if (!res.ok || (json.code && json.code !== 200)) {
    const msg = json.msg || json.message || `Suno API error (${res.status})`
    console.error(`[SunoAPI] Error: ${msg}`, json)
    throw new SunoApiError(msg, json.code || res.status)
  }
  return json as T
}

export class SunoApiError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'SunoApiError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Generate music — returns 2 tracks per call */
export async function generateMusic(params: SunoGenerateParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate', params as unknown as Record<string, unknown>)
}

/** Extend (outpaint) an existing track */
export async function extendMusic(params: SunoExtendParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/extend', params as unknown as Record<string, unknown>)
}

/** Replace a section (inpaint) within a track */
export async function replaceSection(params: SunoReplaceSectionParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/replace-section', params as unknown as Record<string, unknown>)
}

/** Upload audio and create a cover in a new style */
export async function uploadAndCover(params: SunoUploadCoverParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/upload-cover', params as unknown as Record<string, unknown>)
}

/** Upload audio and extend it */
export async function uploadAndExtend(params: SunoUploadExtendParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/upload-extend', params as unknown as Record<string, unknown>)
}

/** Add vocals to an instrumental track */
export async function addVocals(params: SunoAddVocalsParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/add-vocals', params as unknown as Record<string, unknown>)
}

/** Add instrumental backing to a vocal/melody recording */
export async function addInstrumental(params: SunoAddInstrumentalParams): Promise<SunoTaskResponse> {
  return sunoPost('/generate/add-instrumental', params as unknown as Record<string, unknown>)
}

/** Create a reusable persona from a generated track (FREE) */
export async function generatePersona(params: SunoPersonaParams): Promise<SunoPersonaResponse> {
  return sunoPost<SunoPersonaResponse>('/generate/generate-persona', params as unknown as Record<string, unknown>)
}

/** Boost/enhance a style description for V4.5 (FREE) */
export async function boostStyle(params: SunoBoostStyleParams): Promise<SunoBoostStyleResponse> {
  return sunoPost<SunoBoostStyleResponse>('/style/generate', params as unknown as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// Polling / Status
// ---------------------------------------------------------------------------

/** Check the status of a generation task */
export async function getTaskStatus(taskId: string): Promise<SunoTaskStatus> {
  return sunoGet<SunoTaskStatus>(`/generate/record-info?taskId=${encodeURIComponent(taskId)}`)
}

/** Get remaining Suno API credits */
export async function getSunoCredits(): Promise<number> {
  const res = await sunoGet<SunoCreditsResponse>('/generate/credit')
  return res.data
}

/**
 * Poll a task until it completes or times out.
 * @param taskId - The Suno task ID
 * @param maxWaitMs - Maximum wait time in ms (default 10 minutes)
 * @param intervalMs - Polling interval (default 15 seconds)
 * @returns The completed task status
 */
export async function pollTaskUntilDone(
  taskId: string,
  maxWaitMs = 600_000,
  intervalMs = 15_000,
): Promise<SunoTaskStatus> {
  const start = Date.now()

  while (Date.now() - start < maxWaitMs) {
    const status = await getTaskStatus(taskId)

    if (status.data.status === 'SUCCESS') {
      return status
    }
    if (status.data.status === 'FAILED') {
      throw new SunoApiError(
        status.data.errorMessage || 'Generation failed',
        500,
      )
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new SunoApiError('Generation timed out after 10 minutes', 408)
}

// ---------------------------------------------------------------------------
// Sanitise errors — never expose "Suno" to users
// ---------------------------------------------------------------------------

export function sanitizeSunoError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)

  // Rate limit
  if (msg.includes('429') || msg.includes('430') || msg.includes('rate limit') || msg.includes('frequency')) {
    return '444 Radio engines are warming up — please try again in a moment'
  }
  // Insufficient Suno credits (our side, not user's)
  if (msg.includes('Insufficient credits') || msg.includes('429')) {
    return '444 Radio is temporarily at capacity — please try again shortly'
  }
  // Maintenance
  if (msg.includes('455') || msg.includes('maintenance')) {
    return '444 Radio is undergoing a quick tune-up — back in a few minutes'
  }
  // Timeout
  if (msg.includes('timed out') || msg.includes('timeout')) {
    return 'Generation took too long — please try again with a simpler prompt'
  }
  // Generic
  return '444 Radio is locking in, please try again in a few minutes'
}

// ---------------------------------------------------------------------------
// Languages that route through Suno in Pro mode
// ---------------------------------------------------------------------------

export const SUNO_LANGUAGES = [
  'hindi', 'urdu', 'arabic', 'punjabi', 'tamil', 'telugu',
  'bengali', 'marathi', 'gujarati', 'kannada', 'malayalam',
] as const

export type SunoLanguage = (typeof SUNO_LANGUAGES)[number]

export function isSunoLanguage(lang: string): boolean {
  return SUNO_LANGUAGES.includes(lang.toLowerCase() as SunoLanguage)
}

/**
 * Check if a prompt or lyrics contain Indic/Arabic scripts that
 * should route through Suno for better quality.
 */
export function hasIndicOrArabicScript(text: string): boolean {
  // Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, Arabic
  return /[\u0900-\u0D7F\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text)
}
