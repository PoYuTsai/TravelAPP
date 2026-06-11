/**
 * 沉澱刀2 — 候選 zero-trust 解析測試.
 *
 * LLM 是 UNTRUSTED candidate producer：驗 code fence 剝除、JSON/陣列/欄位防衛、
 * cap 5、欄位 500 chars、occurrences/sourceLines 正規化、error 絕不帶 raw 原文。
 */

import { describe, it, expect } from 'vitest'
import {
  parseDistillCandidates,
  DistillParseError,
  DISTILL_MAX_CANDIDATES,
  DISTILL_FIELD_MAX_CHARS,
} from '../distill/candidates'

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    question: '清邁到拜縣包車多少錢？',
    answer: '一般報 2500-3000 泰銖，看車型。',
    sourceLines: [3, 7],
    occurrences: 2,
    ...overrides,
  }
}

describe('parseDistillCandidates', () => {
  it('合法 JSON 陣列 → 正確解析所有欄位', () => {
    const raw = JSON.stringify([
      candidate(),
      candidate({
        question: '2月可以上高山嗎？',
        answer: '可以，2月是旱季。',
        sourceLines: [12],
        occurrences: 3,
      }),
    ])
    expect(parseDistillCandidates(raw)).toEqual([
      {
        question: '清邁到拜縣包車多少錢？',
        answer: '一般報 2500-3000 泰銖，看車型。',
        sourceLines: [3, 7],
        occurrences: 2,
      },
      {
        question: '2月可以上高山嗎？',
        answer: '可以，2月是旱季。',
        sourceLines: [12],
        occurrences: 3,
      },
    ])
  })

  it('帶 ```json code fence → 剝掉後照常解析（LLM 慣性防衛）', () => {
    const raw = '```json\n' + JSON.stringify([candidate()]) + '\n```'
    const parsed = parseDistillCandidates(raw)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].question).toBe('清邁到拜縣包車多少錢？')
  })

  it('帶無語言標記 ``` code fence → 也照常解析', () => {
    const raw = '```\n' + JSON.stringify([candidate()]) + '\n```'
    expect(parseDistillCandidates(raw)).toHaveLength(1)
  })

  it('空陣列 [] → 回 []（合法：完全沒有常規問答）', () => {
    expect(parseDistillCandidates('[]')).toEqual([])
  })

  it('非 JSON → throw DistillParseError(invalid_json)，且不洩漏 raw 原文', () => {
    const leaky = '抱歉，對話裡提到蔡大哥喬價 1800 的事'
    let caught: unknown
    try {
      parseDistillCandidates(leaky)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(DistillParseError)
    const message = (caught as DistillParseError).message
    expect(message).toContain('invalid_json')
    expect(message).not.toContain('蔡大哥')
    expect(message).not.toContain('1800')
  })

  it('JSON 但非陣列（物件）→ throw not_array', () => {
    expect(() => parseDistillCandidates('{"question":"q","answer":"a"}')).toThrow(
      'not_array'
    )
  })

  it('JSON 但非陣列（字串）→ throw not_array', () => {
    expect(() => parseDistillCandidates('"只是一個字串"')).toThrow('not_array')
  })

  it('元素缺 question → throw invalid_candidate', () => {
    const raw = JSON.stringify([{ answer: 'a', sourceLines: [1], occurrences: 1 }])
    expect(() => parseDistillCandidates(raw)).toThrow('invalid_candidate')
  })

  it('元素缺 answer → throw invalid_candidate', () => {
    const raw = JSON.stringify([{ question: 'q', sourceLines: [1], occurrences: 1 }])
    expect(() => parseDistillCandidates(raw)).toThrow('invalid_candidate')
  })

  it('question 非 string → throw invalid_candidate', () => {
    const raw = JSON.stringify([candidate({ question: 42 })])
    expect(() => parseDistillCandidates(raw)).toThrow('invalid_candidate')
  })

  it('answer trim 後空 → throw invalid_candidate', () => {
    const raw = JSON.stringify([candidate({ answer: '   ' })])
    expect(() => parseDistillCandidates(raw)).toThrow('invalid_candidate')
  })

  it('元素非物件（字串/null）→ throw invalid_candidate', () => {
    expect(() => parseDistillCandidates('["不是物件"]')).toThrow('invalid_candidate')
    expect(() => parseDistillCandidates('[null]')).toThrow('invalid_candidate')
  })

  it('超過 5 條 → slice 前 5', () => {
    const raw = JSON.stringify(
      Array.from({ length: 7 }, (_, i) => candidate({ question: `問題${i + 1}？` }))
    )
    const parsed = parseDistillCandidates(raw)
    expect(parsed).toHaveLength(DISTILL_MAX_CANDIDATES)
    expect(parsed.map((c) => c.question)).toEqual([
      '問題1？',
      '問題2？',
      '問題3？',
      '問題4？',
      '問題5？',
    ])
  })

  it('question/answer 超過 500 chars → slice 到 500（防衛）', () => {
    const raw = JSON.stringify([
      candidate({ question: 'Q'.repeat(600), answer: '答'.repeat(501) }),
    ])
    const [parsed] = parseDistillCandidates(raw)
    expect(parsed.question).toBe('Q'.repeat(DISTILL_FIELD_MAX_CHARS))
    expect(parsed.answer).toBe('答'.repeat(DISTILL_FIELD_MAX_CHARS))
  })

  it('occurrences 非正整數（缺/負/字串/小數）→ 視為 1', () => {
    const raw = JSON.stringify([
      candidate({ occurrences: undefined }),
      candidate({ occurrences: -3 }),
      candidate({ occurrences: '2' }),
      candidate({ occurrences: 2.5 }),
    ])
    expect(parseDistillCandidates(raw).map((c) => c.occurrences)).toEqual([1, 1, 1, 1])
  })

  it('occurrences 為 0 → 視為 1（非正）', () => {
    const raw = JSON.stringify([candidate({ occurrences: 0 })])
    expect(parseDistillCandidates(raw)[0].occurrences).toBe(1)
  })

  it('sourceLines 非陣列 → 視為 []', () => {
    const raw = JSON.stringify([
      candidate({ sourceLines: undefined }),
      candidate({ sourceLines: '3,7' }),
      candidate({ sourceLines: 5 }),
    ])
    expect(parseDistillCandidates(raw).map((c) => c.sourceLines)).toEqual([[], [], []])
  })

  it('sourceLines 含非正整數元素 → 只留正整數', () => {
    const raw = JSON.stringify([
      candidate({ sourceLines: [3, -1, 0, 2.5, '7', null, 12] }),
    ])
    expect(parseDistillCandidates(raw)[0].sourceLines).toEqual([3, 12])
  })

  it('question/answer 解析後輸出 trim 過的值', () => {
    const raw = JSON.stringify([candidate({ question: '  前後有空白？  ' })])
    expect(parseDistillCandidates(raw)[0].question).toBe('前後有空白？')
  })

  it('cap 常數值固定（Task 5 回覆組裝引用）', () => {
    expect(DISTILL_MAX_CANDIDATES).toBe(5)
    expect(DISTILL_FIELD_MAX_CHARS).toBe(500)
  })
})
