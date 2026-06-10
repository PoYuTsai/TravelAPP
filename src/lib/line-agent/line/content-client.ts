/**
 * content-client.ts — LINE message content fetcher（圖片刀B）.
 *
 * Fetches the binary content of a user-sent LINE message (image) via
 * GET /v2/bot/message/{messageId}/content and returns it base64-encoded for
 * the Anthropic vision adapter.
 *
 * HARD-WON DETAIL: the content endpoint lives on `api-data.line.me`, NOT the
 * `api.line.me` host used by message-client.ts. Mixing them up yields 404s.
 *
 * Error discipline (mirrors case-intake-llm-adapter): every failure throws a
 * `LineContentError` carrying a FIXED code — never the raw transport error,
 * which could echo the channel token or request url. The HTTP status (a
 * number) is attached when known so callers can log it.
 *
 * Size + type guards live HERE (not in the vision adapter) so an oversized or
 * non-image payload is rejected before any model spend.
 */

const LINE_CONTENT_API_BASE = 'https://api-data.line.me/v2/bot'

/**
 * Max raw bytes accepted for a vision image. Anthropic caps images at ~5MB
 * AFTER base64 (which inflates 4/3), so raw bytes are bounded lower to keep a
 * safe margin.
 */
export const MAX_IMAGE_CONTENT_BYTES = 3_750_000

/** Anthropic-vision-supported image media types — everything else is refused. */
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

export type LineContentErrorCode =
  | 'empty_message_id'
  | 'network_error'
  | 'content_not_found'
  | 'content_fetch_failed'
  | 'unsupported_media_type'
  | 'content_too_large'

/** Fixed-code, secret-free content fetch error. */
export class LineContentError extends Error {
  constructor(
    public readonly code: LineContentErrorCode,
    public readonly status?: number
  ) {
    super(`line content fetch failed: ${code}`)
    this.name = 'LineContentError'
  }
}

export interface LineImageContent {
  /** Raw image bytes, base64-encoded (ready for the Anthropic image block). */
  base64: string
  /** Normalized media type, e.g. 'image/jpeg' (parameters stripped). */
  mediaType: string
}

/**
 * Fetch a LINE image message's content.
 *
 * @param messageId   - LINE message ID (from the webhook image event or a
 *                      quotedMessageId pointing at one).
 * @param accessToken - Channel access token.
 * @param fetchFn     - Injectable fetch (tests inject a fake; prod passes fetch).
 */
export async function fetchLineImageContent(
  messageId: string,
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<LineImageContent> {
  if (messageId === '') throw new LineContentError('empty_message_id')

  const url = `${LINE_CONTENT_API_BASE}/message/${messageId}/content`

  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    // Raw transport errors can echo urls/tokens — swallow, keep the code only.
    throw new LineContentError('network_error')
  }

  if (!response.ok) {
    // 404 gets its own code: it is the EXPECTED outcome when the resolved id
    // was not an image message (e.g. a quoted text) or the content expired —
    // callers turn it into an honest "找不到圖片" reply, not a generic failure.
    throw new LineContentError(
      response.status === 404 ? 'content_not_found' : 'content_fetch_failed',
      response.status
    )
  }

  const rawContentType = response.headers.get('content-type') ?? ''
  const mediaType = rawContentType.split(';')[0].trim().toLowerCase()
  if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new LineContentError('unsupported_media_type', response.status)
  }

  const buffer = await response.arrayBuffer()
  if (buffer.byteLength > MAX_IMAGE_CONTENT_BYTES) {
    throw new LineContentError('content_too_large', response.status)
  }

  return { base64: Buffer.from(buffer).toString('base64'), mediaType }
}
