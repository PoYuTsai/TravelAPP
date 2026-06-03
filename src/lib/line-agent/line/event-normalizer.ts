/**
 * LINE webhook event normalizer.
 *
 * Converts raw LINE webhook events (as received from the Messaging API) into
 * typed internal `NormalizedLineEvent` objects.  The rest of the agent layer
 * depends ONLY on `NormalizedLineEvent`; it never touches the raw LINE shape.
 *
 * Normalization rules (fail-closed — only the two allowed sources pass):
 * - source.type === 'user'  → official OA 1:1 customer event  (line_oa)
 * - source.type === 'group' AND groupId === partnerGroupId → partner-group
 *   event (line_partner_group)
 * - source.type === 'group' AND groupId !== partnerGroupId → null (the bot is
 *   in some non-partner group; that traffic is ignored)
 * - source.type === 'room' (multi-person chat) → null (not an OA customer and
 *   not the partner group; must never fall through to line_oa / create_case)
 * - any other / missing source type → null (default-deny)
 *
 * Kind routing:
 *   message.type === 'text' + no quotedMessageId  → 'oa_text' | 'group_text'
 *   message.type === 'text' + quotedMessageId     → 'group_quoted'
 *   message.type === 'image'                      → 'image'
 *   message.type === 'file'                       → 'file'
 *   any other message type in a group             → 'unknown_group'
 *
 * Non-message event types (follow, join, etc.) return null — the webhook
 * handler must not attempt to process them.
 *
 * NOTE: This module does NOT perform OCR.  Image/file events carry the LINE
 *       message ID; the caller must fetch content separately.
 */

import type { AgentSourceChannel } from '../types'

// ---------------------------------------------------------------------------
// Quoted reference
// ---------------------------------------------------------------------------

export interface QuotedRef {
  /** The LINE message ID of the message being quoted/replied to. */
  quotedMessageId: string
  /** Text content of the quoted message, if LINE includes it in the event. */
  quotedText?: string
}

// ---------------------------------------------------------------------------
// Normalized event kinds
// ---------------------------------------------------------------------------

export type NormalizedLineEventKind =
  | 'oa_text'        // Official OA 1:1 customer text message
  | 'group_text'     // Partner group plain text message
  | 'group_quoted'   // Partner group text that quotes/replies to another message
  | 'image'          // Image message (OA or group) — carry messageId for OCR later
  | 'file'           // File/document message — carry messageId for download later
  | 'unknown_group'  // Anything else in the group (sticker, video, audio, …)

// ---------------------------------------------------------------------------
// Normalized event shape
// ---------------------------------------------------------------------------

export interface NormalizedLineEvent {
  /** Discriminant for routing. */
  kind: NormalizedLineEventKind

  /** Surface that produced this event. */
  sourceChannel: AgentSourceChannel

  /** LINE user ID of the event sender. */
  lineUserId: string

  /** LINE group ID — present for group events, undefined for OA 1:1. */
  groupId?: string

  /** LINE message ID (used to fetch image/file content, or as a case link key). */
  messageId: string

  /** Text content — present for text events, undefined for image/file. */
  text?: string

  /** Quoted message reference — present for group_quoted events. */
  quotedRef?: QuotedRef

  /**
   * True when the bot is being addressed in the partner group (structured
   * mention of the bot userId, or an alias/wake-word in the text).
   *
   * SINGLE SOURCE OF TRUTH: permissions.ts reads this boolean and never runs
   * its own mention regex.  HARD RULE: this is ONLY ever true for
   * `sourceChannel === 'line_partner_group'`.  A `line_oa` customer event is
   * ALWAYS `false`, even if the text literally contains `@bot` — a customer can
   * never trigger an automated reply.  Always assigned (required boolean).
   */
  mentionsBot: boolean

  /** LINE event timestamp (milliseconds since epoch). */
  timestamp: number
}

// ---------------------------------------------------------------------------
// Raw LINE event type stubs (minimal, avoids SDK dependency)
// ---------------------------------------------------------------------------

// We deliberately type the raw input as `unknown` to keep a clear boundary
// between "external attacker input" and "internally typed data".

// `any` is intentional: this is untyped external webhook input that the
// normalizer indexes into defensively before producing typed internal events.
// (The project's ESLint preset does not enable @typescript-eslint/no-explicit-any.)
type RawLineEvent = Record<string, any>

// ---------------------------------------------------------------------------
// Bot-mention detection (partner group only — design 2026-06-03 §A)
// ---------------------------------------------------------------------------

// @-prefixed CJK aliases (a partner formally tags the bot). The leading `@` is
// required so the brand name (清微旅行) typed casually never counts as a tag.
// CJK has no useful word boundary, so these are matched as literal substrings.
const BOT_MENTION_AT_CJK = /@(?:清微旅行chiangway_travel|清微旅行|清微AI助理|清微AI)/i
// @-prefixed latin aliases — word-boundary guarded (trailing `\b`) so `@bot`
// fires but `@botany` / `@AIGC` / `@ccc` do NOT widen the trigger.
const BOT_MENTION_AT_LATIN = /@(?:AI|bot|cc)\b/i
// CJK wake words a partner may say without `@` (口語呼叫). Literal substrings.
const BOT_WAKE_WORDS_CJK = /清微AI|清微助理/
// Bare latin "bot" wake word — word-boundary guarded so it fires on a
// standalone "bot" but NOT inside "robot" / "chatbot".
const BOT_WAKE_WORD_BOT = /\bbot\b/i

function textMentionsBot(text: string): boolean {
  return (
    BOT_MENTION_AT_CJK.test(text) ||
    BOT_MENTION_AT_LATIN.test(text) ||
    BOT_WAKE_WORDS_CJK.test(text) ||
    BOT_WAKE_WORD_BOT.test(text)
  )
}

/**
 * Compute `mentionsBot` for a partner-group message.  Structured mention
 * (LINE's `message.mention.mentionees`) is preferred when `botUserId` is known;
 * the text alias/wake-word fallback covers the (common) case where botUserId is
 * unset or LINE omits the structured block.
 */
function computeMentionsBot(message: Record<string, any>, botUserId: string): boolean {
  const mentionees = message.mention?.mentionees
  const structural =
    botUserId !== '' &&
    Array.isArray(mentionees) &&
    mentionees.some((m) => m?.userId === botUserId)
  if (structural) return true

  const text = typeof message.text === 'string' ? message.text : ''
  return textMentionsBot(text)
}

// ---------------------------------------------------------------------------
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a single raw LINE webhook event.
 *
 * @param raw             - The raw event object from the LINE webhook payload.
 * @param partnerGroupId  - The configured partner group ID (from env/config).
 * @param botUserId       - The bot's own LINE userId (from LINE_BOT_USER_ID).
 *                          Optional/empty → mention falls back to text aliases.
 * @returns A `NormalizedLineEvent`, or `null` if the event is not actionable.
 */
export function normalizeLineEvent(
  raw: RawLineEvent,
  partnerGroupId: string,
  botUserId = ''
): NormalizedLineEvent | null {
  // Only handle 'message' type events.  Follow/join/leave/postback etc. are
  // not actionable in MVP; return null so the handler skips them.
  if (raw.type !== 'message') return null

  const source = raw.source ?? {}

  // Fail-closed source guard. Only two source shapes are actionable:
  //   - 'user'  → OA 1:1 customer event (line_oa)
  //   - 'group' whose groupId === partnerGroupId → partner-group event
  // Everything else returns null so the handler ignores it and it never
  // becomes a case/state:
  //   - 'room'  → LINE multi-person chat; not the partner group, not an OA
  //     customer. Must NOT fall through to line_oa / create_case.
  //   - 'group' with a non-partner groupId → the bot is in some other group.
  //   - any unrecognized / missing source type → default-deny.
  if (
    source.type !== 'user' &&
    !(source.type === 'group' && source.groupId === partnerGroupId)
  ) {
    return null
  }

  const message = raw.message ?? {}
  const timestamp: number = raw.timestamp ?? Date.now()

  const lineUserId: string = source.userId ?? ''
  const messageId: string = message.id ?? ''
  const messageType: string = message.type ?? ''

  // Determine the source channel
  const isGroupEvent = source.type === 'group'
  const groupId: string | undefined = isGroupEvent ? source.groupId : undefined
  const sourceChannel: AgentSourceChannel = isGroupEvent
    ? 'line_partner_group'
    : 'line_oa'

  // HARD RULE: mention detection is partner-group only.  line_oa is ALWAYS
  // false so a customer can never trigger a reply, regardless of text content.
  const mentionsBot =
    sourceChannel === 'line_partner_group'
      ? computeMentionsBot(message, botUserId)
      : false

  // Build the normalized event based on message type
  if (messageType === 'text') {
    const text: string = message.text ?? ''
    const quotedMessageId: string | undefined = message.quotedMessageId

    // Determine kind: quoted reply or plain text
    if (isGroupEvent && quotedMessageId) {
      const quotedRef: QuotedRef = {
        quotedMessageId,
        quotedText: message.quotedText,
      }
      return {
        kind: 'group_quoted',
        sourceChannel,
        lineUserId,
        groupId,
        messageId,
        text,
        quotedRef,
        mentionsBot,
        timestamp,
      }
    }

    const kind: NormalizedLineEventKind = isGroupEvent ? 'group_text' : 'oa_text'
    return {
      kind,
      sourceChannel,
      lineUserId,
      groupId,
      messageId,
      text,
      mentionsBot,
      timestamp,
    }
  }

  if (messageType === 'image') {
    return {
      kind: 'image',
      sourceChannel,
      lineUserId,
      groupId,
      messageId,
      // text intentionally absent — caller fetches image via messageId
      mentionsBot,
      timestamp,
    }
  }

  if (messageType === 'file') {
    return {
      kind: 'file',
      sourceChannel,
      lineUserId,
      groupId,
      messageId,
      // text intentionally absent — caller downloads file via messageId
      mentionsBot,
      timestamp,
    }
  }

  // Sticker, audio, video, location, etc. in a group → unknown_group
  // OA-side unknowns are also surfaced here so the router can decide to ignore.
  return {
    kind: 'unknown_group',
    sourceChannel,
    lineUserId,
    groupId,
    messageId,
    mentionsBot,
    timestamp,
  }
}
