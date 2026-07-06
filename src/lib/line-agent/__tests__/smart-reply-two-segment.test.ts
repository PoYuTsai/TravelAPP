import { describe, it, expect } from 'vitest'
import {
  SMART_REPLY_SYSTEM_PROMPT,
  OUTBOUND_HEADER,
  INTERNAL_HEADER,
  ensureTwoSegments,
} from '../partner-group/smart-reply-agent'

describe('SMART_REPLY_SYSTEM_PROMPT (tripwire)', () => {
  it('規範兩段格式與「對外段零贅述」', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toContain(OUTBOUND_HEADER)
    expect(SMART_REPLY_SYSTEM_PROMPT).toContain(INTERNAL_HEADER)
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/可直接複製|不要.*我幫你整理|不要.*以上/)
  })
  it('規範 RAG 優先、web 標「待確認」、只列真缺', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/案例|RAG|自家/)
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/待確認/)
  })
  it('絕不自動回客人、只回夥伴群', () => {
    expect(SMART_REPLY_SYSTEM_PROMPT).toMatch(/夥伴|不.*直接.*客人|不代發/)
  })
})

describe('ensureTwoSegments', () => {
  it('已含兩段 header ⇒ 原樣回', () => {
    const t = `${OUTBOUND_HEADER}\n建議行程…\n\n${INTERNAL_HEADER}\n待確認：航班`
    expect(ensureTwoSegments(t)).toBe(t)
  })
  it('LLM 漏了 header ⇒ 包成對外段（fail-safe，永遠有可複製內容）', () => {
    const out = ensureTwoSegments('就是一段沒有標頭的內容')
    expect(out.startsWith(OUTBOUND_HEADER)).toBe(true)
    expect(out).toContain('就是一段沒有標頭的內容')
  })
})
