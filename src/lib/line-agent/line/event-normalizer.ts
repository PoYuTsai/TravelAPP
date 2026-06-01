/**
 * LINE webhook event normalizer.
 *
 * Converts raw LINE webhook events (as received from the Messaging API) into
 * typed internal `NormalizedLineEvent` objects.  The rest of the agent layer
 * depends ONLY on `NormalizedLineEvent`; it never touches the raw LINE shape.
 *
 * Normalization rules:
 * - source.type === 'user'  → official OA 1:1 customer event  (line_oa)
 * - source.type === 'group' AND groupId === partnerGroupId → partner-group
 *   event (line_partner_group)
 * - source.type === 'group' AND groupId !== partnerGroupId → null (the bot is
 *   in some non-partner group; that traffic is ignored)
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
// Normalizer
// ---------------------------------------------------------------------------

/**
 * Normalize a single raw LINE webhook event.
 *
 * @param raw             - The raw event object from the LINE webhook payload.
 * @param partnerGroupId  - The configured partner group ID (from env/config).
 * @returns A `NormalizedLineEvent`, or `null` if the event is not actionable.
 */
export function normalizeLineEvent(
  raw: RawLineEvent,
  partnerGroupId: string
): NormalizedLineEvent | null {
  // Only handle 'message' type events.  Follow/join/leave/postback etc. are
  // not actionable in MVP; return null so the handler skips them.
  if (raw.type !== 'message') return null

  const source = raw.source ?? {}

  // Partner-group guard: the bot may be a member of groups other than the
  // configured partner group.  A group event whose groupId does NOT match
  // partnerGroupId is not actionable — return null so the handler ignores it
  // (and it never becomes a line_partner_group event).
  if (source.type === 'group' && source.groupId !== partnerGroupId) {
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
    timestamp,
  }
}
