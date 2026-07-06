/**
 * customer-event.ts
 *
 * Deterministic customer-event classifier for the LINE OA agent, plus an
 * injectable LLM fallback seam — mirrors the structure of `commands/intent.ts`.
 *
 * Design rules (design §3):
 * - Classification is ADVISORY only. It drives internal inbox presentation,
 *   SLA zoning and reminder candidates. It never widens permissions and never
 *   triggers any customer-facing reply or push.
 * - Deterministic keyword/pattern matching runs FIRST — no model, no keys, no
 *   I/O. Only when the deterministic pass returns null does the injected LLM
 *   seam run; M2 ships the safe default which always returns the most
 *   conservative `new_inquiry/low` (unknown → needs human, never fabricated).
 * - `now` is injected so `classifiedAt` stays deterministic and testable.
 */

// ---------------------------------------------------------------------------
// CustomerEventCategory — EXACTLY these 8 values (design §3)
// ---------------------------------------------------------------------------

export type CustomerEventCategory =
  | 'new_inquiry' // 首次詢問、開啟新案
  | 'follow_up_info' // 補上先前缺的資料（日期/人數/年齡…）
  | 'change_request' // 已知需求的變更（改日期、加人、換景點）
  | 'price_question' // 價格指向問題（多少錢、報價是哪間）
  | 'product_or_itinerary_question' // 產品/行程內容問題
  | 'menu_browsing' // rich menu postback / 點選瀏覽，非文字需求
  | 'media_or_ocr_needed' // 圖片/檔案，需 OCR 才能讀內容
  | 'non_actionable' // 貼圖、寒暄、spam，無商務內容

/**
 * Array of all valid categories — useful for validation loops and tests.
 * Keep in sync with the CustomerEventCategory union above.
 */
export const ALL_CUSTOMER_EVENT_CATEGORIES: CustomerEventCategory[] = [
  'new_inquiry',
  'follow_up_info',
  'change_request',
  'price_question',
  'product_or_itinerary_question',
  'menu_browsing',
  'media_or_ocr_needed',
  'non_actionable',
]

// ---------------------------------------------------------------------------
// Input / output contracts
// ---------------------------------------------------------------------------

/** Message media type as mapped from the normalized LINE event. */
export type ClassifyMessageType = 'text' | 'image' | 'file' | 'pdf' | 'sticker'

export interface ClassifyInput {
  /** Raw customer text (may be empty for media/postback events). */
  text: string
  /** Media type of the inbound event. */
  messageType: ClassifyMessageType
  /**
   * Whether the event is a rich-menu / postback selection. Normalizer does not
   * yet surface postback in M2 (Open Item); this is the seam so the classifier
   * is already correct once postback is wired.
   */
  isPostback: boolean
  /** Whether the case already has prior customer messages. */
  hasPriorMessages: boolean
  /** Fields the team still needs from the customer (drives follow_up_info). */
  missingFields: string[]
  /** ISO-8601 timestamp, injected for determinism. */
  now: string
}

export interface CustomerEventClassification {
  category: CustomerEventCategory
  confidence: 'high' | 'medium' | 'low'
  source: 'deterministic' | 'llm'
  /** Names of the patterns that matched — for audit/debug. */
  signals: string[]
  /** ISO-8601 classification time (= input.now). */
  classifiedAt: string
}

/**
 * Seam interface for customer-event classification.
 *
 * Production may eventually inject a real model adapter. Test code and M2
 * production both inject `safeDefaultCustomerClassifier` — no API keys, no
 * model calls. The classification result is ALWAYS advisory.
 */
export interface CustomerEventClassifier {
  classify(input: ClassifyInput): Promise<CustomerEventClassification>
}

// ---------------------------------------------------------------------------
// Deterministic keyword patterns (source of truth — not inlined per branch)
// ---------------------------------------------------------------------------

const MEDIA_MESSAGE_TYPES: ReadonlySet<ClassifyMessageType> = new Set<ClassifyMessageType>([
  'image',
  'file',
  'pdf',
])

/** Change intent — modify an already-known requirement. */
const CHANGE_PATTERN = /改成|改為|改到|改日|換成|換到|改一下|加一個|加個|多加|多帶|取消|不要了?|延後|提前|延期/

/** Price-directed signals — highest-risk text class, surfaced first. */
const PRICE_PATTERN = /多少錢|價格|報價|費用|幾錢|多少|報多少|NT\$|台幣|泰銖|銖|預算/

/**
 * Product / itinerary content signals (non-price). Real LINE messages often
 * omit punctuation, so interrogative / topic words (哪間 / 哪天 / 含不含 /
 * 有含 / 行程 / 景點 …) count as itinerary-question signals in their own right
 * — a trailing 「嗎」or 「？」 is NOT required (review P2).
 */
const PRODUCT_PATTERN =
  /哪間|哪一間|哪一家|哪天|哪一天|哪裡|哪邊|哪個|含不含|包不包|有沒有|有含|含午餐|含早餐|幾點|行程|景點|怎麼安排|怎麼去|怎麼玩|可以去|能去|去哪/

/** New-inquiry travel-intent words (only meaningful with no prior history). */
const INTENT_PATTERN = /包車|行程|想去|想帶|帶小孩|清邁|清迈|親子|自由行|規劃|包個車|玩幾天/

/** Small-talk / greeting / sticker words → non_actionable ONLY when no business signal. */
const SMALLTALK_PATTERN = /謝謝|感謝|感恩|你好|您好|哈囉|哈嘍|嗨|收到|好的|沒問題|貼圖|表情/

/**
 * Travel / business signals that VETO a non_actionable verdict: if any appear,
 * a greeting-prefixed message is NOT small talk and must reach a human
 * (review P1). Combines the actionable patterns plus inline travel facts.
 */
const BUSINESS_SIGNAL_PATTERNS: RegExp[] = [
  CHANGE_PATTERN,
  PRICE_PATTERN,
  PRODUCT_PATTERN,
  INTENT_PATTERN,
  /\d{1,2}\s*[/.\-月]\s*\d{1,2}/, // date
  /\d+\s*大\s*\d+\s*小|\d+\s*位|\d+\s*人/, // party size
  /\d+\s*(?:歲|岁)/, // child ages
  /住|飯店|酒店|旅館|民宿|古城|尼曼|hotel/i, // lodging
  /航班|班機|機場|机场|接機|接机|落地|起飛/, // flight / pickup
]

function hasBusinessSignal(text: string): boolean {
  return BUSINESS_SIGNAL_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Per-field detectors for follow_up_info: does the text carry a value that
 * satisfies one of the case's missing fields?  Keyed by the missingField names
 * produced by `case-triage.ts`.
 */
const MISSING_FIELD_DETECTORS: Record<string, RegExp> = {
  travelDates: /\d{1,2}\s*[/.\-月]\s*\d{1,2}/,
  partySize: /\d+\s*大\s*\d+\s*小|\d+\s*位|\d+\s*人|\d+\s*大人|\d+\s*小孩/,
  childAges: /\d+(?:\.\d+)?\s*(?:歲|岁)/,
  childSeatNeeds: /兒童座椅|儿童座椅|安全座椅|不用座椅|不需座椅/,
  hotelOrPickupLocation: /住|飯店|酒店|旅館|民宿|古城|尼曼|hotel/i,
  accommodationLocation: /住|飯店|酒店|旅館|民宿|古城|尼曼|hotel/i,
  flightOrPickupInfo: /航班|班機|機場|机场|接機|接机|落地|起飛|\d{1,2}:\d{2}/,
}

function textSatisfiesMissingField(text: string, missingFields: string[]): boolean {
  return missingFields.some((field) => {
    const detector = MISSING_FIELD_DETECTORS[field]
    return detector ? detector.test(text) : false
  })
}

// ---------------------------------------------------------------------------
// Deterministic classifier
// ---------------------------------------------------------------------------

/**
 * Classify a customer event using deterministic signals only.
 *
 * Returns null when no signal matches (caller falls back to the injected LLM
 * seam / safe default).  Priority order (design §3.1):
 *   media_or_ocr_needed → menu_browsing → change_request → price_question
 *   → product_or_itinerary_question → follow_up_info → new_inquiry
 *   → non_actionable (greeting/sticker only).
 */
export function classifyCustomerEventDeterministic(
  input: ClassifyInput
): CustomerEventClassification | null {
  const { text, messageType, isPostback, hasPriorMessages, missingFields, now } = input

  const build = (
    category: CustomerEventCategory,
    signals: string[]
  ): CustomerEventClassification => ({
    category,
    confidence: 'high',
    source: 'deterministic',
    signals,
    classifiedAt: now,
  })

  // 1. media wins regardless of any accompanying text (design §3.1 priority).
  if (MEDIA_MESSAGE_TYPES.has(messageType)) {
    return build('media_or_ocr_needed', ['media'])
  }

  // 2. rich-menu postback / browsing.
  if (isPostback) {
    return build('menu_browsing', ['menu'])
  }

  // sticker-only with no text is small talk.
  if (messageType === 'sticker') {
    return build('non_actionable', ['sticker'])
  }

  const trimmed = (text ?? '').trim()
  if (!trimmed) return null

  // 3. change request — only meaningful when a prior requirement exists.
  if (hasPriorMessages && CHANGE_PATTERN.test(trimmed)) {
    return build('change_request', ['change'])
  }

  // 4. price question — highest-risk text class, before product.
  if (PRICE_PATTERN.test(trimmed)) {
    return build('price_question', ['price'])
  }

  // 5. product / itinerary question (non-price). Topic/interrogative words are
  //    sufficient — no explicit 「嗎」/「？」 required (review P2).
  if (PRODUCT_PATTERN.test(trimmed)) {
    return build('product_or_itinerary_question', ['product'])
  }

  // 6. follow-up info — supplies a value for one of the case's missing fields.
  if (hasPriorMessages && textSatisfiesMissingField(trimmed, missingFields)) {
    return build('follow_up_info', ['follow_up'])
  }

  // 7. new inquiry — no prior history + travel intent word.
  if (!hasPriorMessages && INTENT_PATTERN.test(trimmed)) {
    return build('new_inquiry', ['new_inquiry'])
  }

  // 8. small talk / greeting → non_actionable, but ONLY when there is no
  //    business signal anywhere in the text. A greeting prefix must never
  //    silence a message that also carries a real request (review P1).
  if (SMALLTALK_PATTERN.test(trimmed) && !hasBusinessSignal(trimmed)) {
    return build('non_actionable', ['smalltalk'])
  }

  // Unknown — let the safe default (needs-human) decide.
  return null
}

// ---------------------------------------------------------------------------
// Safe default classifier (LLM seam, dormant in M2)
// ---------------------------------------------------------------------------

/**
 * Safe default classifier used by the webhook wiring in M2.
 *
 * It performs NO API calls and requires NO keys.  Deterministic pass runs
 * first; on a miss it returns the MOST CONSERVATIVE result — `new_inquiry`
 * with `low` confidence — so the case lands in the "needs reply" zone for a
 * human to look at.  It never fabricates facts and never widens permissions
 * (design §3.2).
 */
export const safeDefaultCustomerClassifier: CustomerEventClassifier = {
  async classify(input: ClassifyInput): Promise<CustomerEventClassification> {
    const deterministic = classifyCustomerEventDeterministic(input)
    if (deterministic !== null) {
      return deterministic
    }
    return {
      category: 'new_inquiry',
      confidence: 'low',
      source: 'llm',
      signals: [],
      classifiedAt: input.now,
    }
  },
}
