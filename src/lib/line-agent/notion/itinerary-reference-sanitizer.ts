/**
 * itinerary-reference-sanitizer.ts — design 2026-06-14 §3。
 *
 * 把真 Notion `itinerarySnippet`（帶別人 PII）刷成可複用的活動骨架。
 * 確定性正則、零 LLM、可 fail-closed、零成本零延遲。
 *
 *  - scrub：刪 header 三行（標題姓名 / 人數 / 日期）+ 內文 redact 航班/金額/電話/URL。
 *  - assert（更嚴 denylist）：殘留任一 PII pattern（含敬稱/日期/email）⇒ ok:false，
 *    整筆 record 丟出 reference（寧缺勿漏）。
 *
 * 保留：活動名、餐廳名、出發時間、節奏備註。
 */

export interface SanitizeResult {
  ok: boolean
  /** 僅 ok 時存在：刷乾淨的活動骨架。 */
  skeleton?: string
  /** 僅 !ok 時存在：固定 code，永不帶原文。 */
  reason?: 'residual_pii' | 'empty'
}

/** 第一刀：整行刪的 header pattern（個資集中、對參考零價值）。 */
const HEADER_LINE_RES: RegExp[] = [
  /^\s*<.*?(?:先生|小姐|太太|一家).*?訂製>/u, // 標題姓名
  /^\s*[👨‍👩‍👧‍👦🧑👪]*\s*人數[：:]/u,
  /^\s*📅?\s*日期[：:]/u,
]

/** 第二刀：內文 redact 的高精度 pattern（redact 掉、保留行其餘）。 */
const BODY_SCRUB_RES: RegExp[] = [
  /(?:華航|長榮|泰航|虎航|亞航)[^，。、\n]*?\d{1,2}[:：]\d{2}/gu, // 航空+時間
  /\b[A-Z]{2}\s?\d{2,4}\b/g, // 航班碼 CI851
  /(?:NT\$|THB|฿)\s?[\d,]+/g, // 幣別金額
  /[\d,]+\s?(?:萬\s?(?:泰銖|銖|元)?|千\s?(?:泰銖|銖|元)?|泰銖|銖|元)/g, // 中文金額（含「8 萬泰銖」複合單位）
  /分潤[^，。、\n]*/gu,
  /(?:\+?886|0)\d[\d\- ]{6,}\d/g, // 電話
  /https?:\/\/\S+/g,
  /\S*notion\.(?:so|site)\/\S+/g,
]

/**
 * fail-closed denylist（比 scrub 更嚴）：scrub 後仍命中任一 ⇒ 整筆丟。
 * 多含 scrub 不處理但必須阻擋的：敬稱姓氏、ISO/slash 日期、email。
 */
const RESIDUAL_PII_RES: RegExp[] = [
  /[A-Z]{2}\s?\d{2,4}/, // 航班碼
  /NT\$|THB|฿|泰銖|分潤/u, // 金額
  /(?:\+?886|0)\d[\d\- ]{6,}\d/, // 電話
  /https?:\/\/|notion\.(?:so|site)/u, // URL
  /[\w.+-]+@[\w.-]+\.\w+/u, // email
  /\d{4}[/／-]\d{1,2}[/／-]\d{1,2}/u, // 日期
  /(?:先生|小姐|太太|一家)/u, // 敬稱姓氏
]

export function sanitizeItinerarySnippet(raw: string): SanitizeResult {
  if (!raw || raw.trim() === '') return { ok: false, reason: 'empty' }

  const kept = raw
    .split('\n')
    .filter((line) => !HEADER_LINE_RES.some((re) => re.test(line)))
    .map((line) => BODY_SCRUB_RES.reduce((acc, re) => acc.replace(re, ''), line))
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/g, ''))
    .filter((line) => line.trim() !== '')

  const skeleton = kept.join('\n').trim()
  if (skeleton === '') return { ok: false, reason: 'empty' }

  // fail-closed：scrub 漏網的任一 PII pattern ⇒ 整筆丟（寧缺勿漏）。
  if (RESIDUAL_PII_RES.some((re) => re.test(skeleton))) {
    return { ok: false, reason: 'residual_pii' }
  }

  return { ok: true, skeleton }
}
