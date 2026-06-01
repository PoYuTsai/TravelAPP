/**
 * LINE Messaging API client — fetch-based, no SDK.
 *
 * Sends push and reply messages via the LINE Messaging API REST endpoints.
 * The channel access token is accepted as a parameter (not read from global
 * env directly), so tests can inject a fake token without hitting the network.
 *
 * All functions throw a `LineApiError` on non-2xx responses, including the
 * full status code and response body text (never minified) so callers can
 * log and retry appropriately.
 *
 * NOTE: Do not add LINE mark-as-read calls here.  The webhook is a
 * future-event source, not a historical inbox crawler.  Mark-as-read is
 * not required in MVP.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_API_BASE = 'https://api.line.me/v2/bot'

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class LineApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: string,
    message: string
  ) {
    super(message)
    this.name = 'LineApiError'
  }
}

// ---------------------------------------------------------------------------
// Message object shapes (minimal, covers MVP text messages)
// ---------------------------------------------------------------------------

export interface LineTextMessage {
  type: 'text'
  text: string
}

export type LineMessage = LineTextMessage

// ---------------------------------------------------------------------------
// Push message
// ---------------------------------------------------------------------------

/**
 * Push a message to a user or group.
 *
 * @param to          - LINE user ID or group ID.
 * @param messages    - One or more message objects to send.
 * @param accessToken - Channel access token.
 * @param fetchFn     - Injectable fetch function (defaults to global `fetch`).
 *                      Pass a mock in tests to avoid network calls.
 */
export async function pushMessage(
  to: string,
  messages: LineMessage[],
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const url = `${LINE_API_BASE}/message/push`
  const body = JSON.stringify({ to, messages })

  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    })
  } catch (err) {
    throw new LineApiError(
      0,
      String(err),
      `pushMessage network error: ${String(err)}`
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '(unreadable)')
    throw new LineApiError(
      response.status,
      text,
      `pushMessage failed with status ${response.status}: ${text}`
    )
  }
}

// ---------------------------------------------------------------------------
// Reply message
// ---------------------------------------------------------------------------

/**
 * Reply to a webhook event using its reply token.
 *
 * Reply tokens are single-use and expire within ~30 seconds of the webhook
 * event.  Prefer push messages for anything deferred beyond a quick ack.
 *
 * @param replyToken  - The reply token from the webhook event.
 * @param messages    - One or more message objects to send.
 * @param accessToken - Channel access token.
 * @param fetchFn     - Injectable fetch function (defaults to global `fetch`).
 */
export async function replyMessage(
  replyToken: string,
  messages: LineMessage[],
  accessToken: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const url = `${LINE_API_BASE}/message/reply`
  const body = JSON.stringify({ replyToken, messages })

  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body,
    })
  } catch (err) {
    throw new LineApiError(
      0,
      String(err),
      `replyMessage network error: ${String(err)}`
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '(unreadable)')
    throw new LineApiError(
      response.status,
      text,
      `replyMessage failed with status ${response.status}: ${text}`
    )
  }
}
