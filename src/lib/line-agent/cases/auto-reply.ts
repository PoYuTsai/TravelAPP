/**
 * auto-reply.ts
 *
 * Rich-menu / auto-reply mapping schema — DORMANT in M2.
 *
 * ⚠️ This schema NEVER sends anything in M2.  The global `autoReplyEnabled`
 * flag and every per-mapping `enabled` flag are pinned to the `false` literal
 * type, so the type checker rejects any attempt to flip them on.  The
 * `draftReplyTemplate` strings exist ONLY for the operator inbox view — they
 * are never passed to the LINE reply/push API.  Enabling auto-reply is a
 * future milestone gated on an explicit decision by Eric (CLAUDE.md:
 * "LINE OA customer messages must not be auto-replied to").
 */

import type { CustomerEventCategory } from './customer-event'

// ---------------------------------------------------------------------------
// Trigger union — how an inbound event maps onto a category
// ---------------------------------------------------------------------------

export type AutoReplyTrigger =
  | { type: 'rich_menu_postback'; value: string }
  | { type: 'keyword'; value: string }

// ---------------------------------------------------------------------------
// Mapping + config types — `enabled` pinned to false at the type level
// ---------------------------------------------------------------------------

export interface AutoReplyMapping {
  /** Stable id for operator references / audit. */
  id: string
  /** What inbound signal this mapping reacts to. */
  trigger: AutoReplyTrigger
  /** The customer-event category this mapping represents. */
  mapsToCategory: CustomerEventCategory
  /**
   * Operator-only draft suggestion. NEVER sent to the customer in M2 — shown
   * in the inbox so the operator can copy/adapt it manually.
   */
  draftReplyTemplate: string
  /** DORMANT: pinned to false so no mapping can ever fire. */
  enabled: false
}

export interface AutoReplyConfig {
  /** DORMANT global kill-switch: pinned to false at the type level. */
  autoReplyEnabled: false
  mappings: AutoReplyMapping[]
}

// ---------------------------------------------------------------------------
// Default config — placeholder rich-menu sections, all dormant
// ---------------------------------------------------------------------------

/**
 * Default mapping set covering the planned rich-menu sections.  The
 * `trigger.value` keys are PLACEHOLDERS — the real LINE OA postback keys are
 * filled in later once the backend menu is configured (design §11 Open Q).
 */
export const DEFAULT_AUTO_REPLY_CONFIG: AutoReplyConfig = {
  autoReplyEnabled: false,
  mappings: [
    {
      id: 'menu-charter',
      trigger: { type: 'rich_menu_postback', value: 'RICH_MENU_CHARTER_PLACEHOLDER' },
      mapsToCategory: 'menu_browsing',
      draftReplyTemplate: '您好，包車服務可依人數與天數安排，方便提供日期與大小人數嗎？',
      enabled: false,
    },
    {
      id: 'menu-itinerary',
      trigger: { type: 'rich_menu_postback', value: 'RICH_MENU_ITINERARY_PLACEHOLDER' },
      mapsToCategory: 'product_or_itinerary_question',
      draftReplyTemplate: '我們可依親子節奏客製行程，想先了解您預計的天數與想去的景點嗎？',
      enabled: false,
    },
    {
      id: 'menu-quote',
      trigger: { type: 'rich_menu_postback', value: 'RICH_MENU_QUOTE_PLACEHOLDER' },
      mapsToCategory: 'price_question',
      draftReplyTemplate: '報價會依行程內容計算，提供日期、人數與想去的點後即可估算。',
      enabled: false,
    },
    {
      id: 'menu-elephant',
      trigger: { type: 'keyword', value: '大象' },
      mapsToCategory: 'product_or_itinerary_question',
      draftReplyTemplate: '大象體驗有多種營區與時段，方便告訴我同行小孩年齡嗎？',
      enabled: false,
    },
  ],
}
