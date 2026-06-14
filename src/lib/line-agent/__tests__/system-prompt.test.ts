/**
 * system-prompt.test.ts — locks the partner-group persona + guardrail clauses
 * (design 2026-06-03 §7).  These assertions are a tripwire: if anyone silently
 * weakens a guardrail (drops the "no formal quote", "no claiming already
 * replied", "needs Eric's sign-off" clauses) the build breaks.
 */

import { describe, it, expect } from 'vitest'
import {
  buildPartnerGroupSystemPrompt,
  PARTNER_GROUP_SYSTEM_PROMPT,
} from '@/lib/line-agent/partner-group/system-prompt'
import type { PartnerGroupRespondInput } from '@/lib/line-agent/partner-group/responder'

function makeInput(): PartnerGroupRespondInput {
  return {
    event: {
      kind: 'group_text',
      sourceChannel: 'line_partner_group',
      lineUserId: 'U_tsai',
      groupId: 'G_partner',
      messageId: 'M001',
      text: '@bot 看一下這團',
      mentionsBot: true,
      timestamp: 1_700_000_000_000,
    },
    intent: { action: 'analyze', confidence: 'high', source: 'llm' },
    text: '@bot 看一下這團',
  }
}

describe('buildPartnerGroupSystemPrompt', () => {
  const prompt = buildPartnerGroupSystemPrompt(makeInput())

  it('declares the internal partner-group assistant persona', () => {
    expect(prompt).toContain('內部夥伴群')
    expect(prompt).toContain('Eric')
  })

  it('names the operating partners (Lulu / 彥均) so they are not treated as customers', () => {
    expect(prompt).toContain('Lulu')
    expect(prompt).toContain('彥均')
    expect(prompt).toContain('夥伴是主要對客窗口')
  })

  it('locks the Traditional-Chinese + concise/actionable style clauses', () => {
    expect(prompt).toContain('繁體中文')
    expect(prompt).toContain('簡短')
    expect(prompt).toContain('條列')
  })

  it('forbids claiming the customer was already replied to / contacted', () => {
    expect(prompt).toContain('不得')
    expect(prompt).toContain('已回覆')
    expect(prompt).toContain('已聯繫')
  })

  it('forbids claiming real-time data (flights / tickets / weather / stock) was looked up', () => {
    expect(prompt).toContain('即時資料')
    expect(prompt).toContain('航班')
    expect(prompt).toContain('門票')
    expect(prompt).toContain('天氣')
  })

  it('forbids formal quote numbers / outward commitments and escalates to Eric partner-first', () => {
    expect(prompt).toContain('正式報價')
    // partner-first (Eric 2026-06-07): Eric is the escalation for formal quotes /
    // special commitments / exceptions / high-risk — NOT a blanket 「拍板」 deferral.
    expect(prompt).toContain('Eric 最終確認')
    expect(prompt).not.toContain('拍板')
  })

  it('requires admitting uncertainty rather than fabricating', () => {
    expect(prompt).toContain('不確定就說不確定')
  })

  // --- 清微旅行 domain 車型硬規則（2026-06-05）---
  // 鎖住實務車型判斷，避免 responder 用泛用旅遊車型邏輯。

  it('locks the 小轎車 capacity rule (4 seats, recommend ≤3, up to 4 with kids)', () => {
    expect(prompt).toContain('小轎車')
    expect(prompt).toContain('4 人座')
    expect(prompt).toContain('最多 3 人')
    expect(prompt).toContain('小朋友')
    expect(prompt).toContain('坐到 4 位')
  })

  it('locks the Toyota Commuter rule (10-seat Van, excludes guide/front, ≤9 rear passengers)', () => {
    expect(prompt).toContain('Toyota Commuter')
    expect(prompt).toContain('10 人座')
    expect(prompt).toContain('不含導遊')
    expect(prompt).toContain('副駕')
    expect(prompt).toContain('後座最多 9 位')
  })

  it('forbids volunteering generic vehicle names unless the user said them first', () => {
    expect(prompt).toContain('7-9 人座')
    expect(prompt).toContain('9 人座')
    expect(prompt).toContain('一般廂型車')
    expect(prompt).toContain('泛稱')
    expect(prompt).toContain('使用者原文')
  })

  it('routes 6-person charters toward the Toyota Commuter 10-seat Van', () => {
    expect(prompt).toContain('6 人包車')
    expect(prompt).toContain('Toyota Commuter 10 人座 Van')
  })

  it('flags airport transfers with 6+ luggage to confirm size/count and consider a second vehicle', () => {
    expect(prompt).toContain('機場接送')
    expect(prompt).toContain('行李')
    expect(prompt).toContain('6 件以上')
    expect(prompt).toContain('第二台車')
  })

  it('does not demand a caseId; lists missing info in plain language instead', () => {
    expect(prompt).toContain('不要要求')
    expect(prompt).toContain('caseId')
    expect(prompt).toContain('還缺哪些資訊')
  })

  it('does not over-escalate known hard rules to Eric (only quote/special/exception/high-risk cases)', () => {
    expect(prompt).toContain('不要每句都推回 Eric')
    expect(prompt).toContain('高風險')
  })

  // --- 清微旅行 vehicle-naming + budget polish（2026-06-05）---
  // Preview 實機已過車型硬規則；微調兩點：車型名稱統一、預算不要預設每次問。

  it('unifies vehicle naming to Toyota Commuter and rejects Hiace equivalence/choice', () => {
    expect(prompt).toContain('統一稱「Toyota Commuter 10 人座 Van」')
    expect(prompt).toContain('Hiace 與 Commuter 同級')
    expect(prompt).toContain('不要承諾')
    expect(prompt).toContain('指定 Hiace')
    expect(prompt).toContain('只解讀為「想要廂型車 / Van」')
  })

  it('does not ask for budget by default; only when user raises price or trade-offs are needed', () => {
    expect(prompt).toContain('不要預設每次都問預算區間')
    expect(prompt).toContain('主動提到價格')
    expect(prompt).toContain('方案取捨')
  })

  // 2026-06-13 (Eric Q2 拍板): 排行程請求 → 先用合理假設給一版標註假設的草稿，
  // 文末問哪些要修正，依夥伴二次回覆疊代；不要只反問缺哪些資訊（gather-first）。
  it('itinerary requests get a draft-first reply with labeled assumptions, not just a gap list', () => {
    expect(prompt).toContain('排行程')
    expect(prompt).toContain('排出一版初稿')
    expect(prompt).toContain('標明你')
    expect(prompt).toContain('哪些需要修正')
  })

  // 2026-06-13 (Q2 B 案): 排行程草稿一律吐 customer_itinerary_v1 結構，報價器才解析得了；
  // 形狀範本（標題 / 日期 / 人數 header / Day N｜ 區塊）逐字在場，任一被刪即炸。
  it('itinerary drafts must declare the customer_itinerary_v1 shape (parser-friendly)', () => {
    expect(prompt).toContain('customer_itinerary_v1')
    expect(prompt).toContain('Day N｜')
    expect(prompt).toContain('M/D (週)')
    expect(prompt).toContain('套餐訂製')
    expect(prompt).toContain('日期：YYYY/MM/DD')
    expect(prompt).toContain('人數')
    expect(prompt).toContain('午餐：')
    expect(prompt).toContain('晚餐：')
    expect(prompt).toContain('住宿')
  })

  // 2026-06-13 (Q2 補強): 黑箱發現 persona 會用 **粗體** 包 Day 標題＋漏掉最上面三行
  // header，導致 round-trip parser 解不出而過不了閘。這兩條把「純文字、header 先行」鎖死。
  it('itinerary drafts must be plain-text (no markdown) with the three header lines first', () => {
    expect(prompt).toContain('絕對不要用')
    expect(prompt).toContain('粗體')
    expect(prompt).toContain('markdown')
    expect(prompt).toContain('第一行起')
  })

  // 2026-06-15 Task 7 (Eric): 客人未提供航班時，Day 1 預設早班（華航 CI851／長榮
  // BR257）並標「待確認」，不得臆造確定航班。屬排行程 persona 行為，鎖在 base persona。
  it('defaults Day 1 to an early flight marked 待確認 when no flight given (no fabrication)', () => {
    expect(prompt).toContain('待確認')
    expect(prompt).toContain('CI851')
    expect(prompt).toContain('BR257')
    expect(prompt).toContain('不得臆造確定航班')
  })

  // 2026-06-10 private-group smoke regression: with no geographic anchor in the
  // prompt, a "哪個夜市適合帶小孩" probe came back with TAIPEI night markets.
  // These clauses pin every place/weather/transport answer to Chiang Mai.
  it('anchors all answers to Chiang Mai and forbids defaulting to Taiwan locations', () => {
    expect(prompt).toContain('泰國清邁')
    expect(prompt).toContain('一律以清邁為預設脈絡')
    expect(prompt).toContain('一律假設客人問的是清邁')
    expect(prompt).toContain('不得以台灣或其他城市的地點回答')
  })

  // 2026-06-10 刀4 (Eric): tone split — casual chat relaxed, business decisive.
  it('locks the tone split: casual chat relaxed, work topics professional and decisive', () => {
    expect(prompt).toContain('閒聊')
    expect(prompt).toContain('輕鬆自然')
    expect(prompt).toContain('專業')
    expect(prompt).toContain('果斷')
  })

  // 2026-06-10 刀4 (Eric): plain-spoken self-intro for the real partner group.
  // Web search is NOT wired into the responder (tool gate scaffolding only),
  // so the intro must honestly say it cannot browse — never promise googling.
  it('locks the self-intro: AI assistant persona, tag/quote to reach it, partners are final decision', () => {
    expect(prompt).toContain('自我介紹')
    expect(prompt).toContain('AI 小助理')
    expect(prompt).toContain('ChatGPT')
    expect(prompt).toContain('引用我的訊息')
    expect(prompt).toContain('其餘時間不會主動打擾')
    expect(prompt).toContain('過往')
    expect(prompt).toContain('初版行程草稿')
    expect(prompt).toContain('最高決策')
    expect(prompt).toContain('測試階段')
  })

  it('self-intro honestly admits it cannot browse the web (web_search not wired)', () => {
    expect(prompt).toContain('還不能上網')
  })

  // 2026-06-11 正式群實測: Chun 傳客人對話截圖 @bot，bot 讀不到圖片，先前
  // 卻回「可以上傳圖片給我，我會幫忙看」— 與台北夜市/web_search 同型的誠實性
  // 漏洞。在 vision 真接上之前，prompt 必須明說讀不到圖片、請貼文字。
  it('honestly admits it cannot read image content and asks for pasted text instead', () => {
    expect(prompt).toContain('讀不到圖片內容')
    expect(prompt).toContain('請把客人的文字訊息直接貼上來')
    expect(prompt).not.toContain('上傳圖片給我')
  })

  // 2026-06-12 刀A: quote-to-bot (M3.6c) 的引用內容進 prompt 尾端 —
  // 口語詞（「保險一點」「再大一點」）靠引用脈絡消歧；guardrails 一字不少。
  describe('quotedBotContent context (knife A)', () => {
    it('returns the frozen prompt verbatim when no quote', () => {
      expect(buildPartnerGroupSystemPrompt(makeInput())).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    })

    it('appends the quoted-context section when quotedBotContent is present', () => {
      const built = buildPartnerGroupSystemPrompt({
        ...makeInput(),
        quotedBotContent: '大車後排放球袋比較穩',
      })
      expect(built).toContain(PARTNER_GROUP_SYSTEM_PROMPT) // guardrails 一字不少
      expect(built).toContain('【引用脈絡】')
      expect(built).toContain('大車後排放球袋比較穩')
    })

    it('ignores a whitespace-only quotedBotContent', () => {
      expect(
        buildPartnerGroupSystemPrompt({ ...makeInput(), quotedBotContent: '  ' })
      ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    })
  })

  // 2026-06-13 檢索閉環刀: 沉澱知識區塊接 persona 之後、引用之前。
  // 知識缺席 ⇒ 與現行輸出 byte-identical（迴歸鎖）。
  describe('buildPartnerGroupSystemPrompt — 檢索閉環刀知識區塊', () => {
    it('無知識（undefined/null/空白）⇒ 輸出與現行 byte-identical（迴歸鎖）', () => {
      expect(buildPartnerGroupSystemPrompt(makeInput())).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
      expect(buildPartnerGroupSystemPrompt(makeInput(), null)).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
      expect(buildPartnerGroupSystemPrompt(makeInput(), '  ')).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    })

    it('有知識 ⇒ 區塊接在 frozen persona 尾端', () => {
      const knowledge = '【清微旅行沉澱問答】\nQ：q\nA：a'
      const prompt = buildPartnerGroupSystemPrompt(makeInput(), knowledge)
      expect(prompt).toBe([PARTNER_GROUP_SYSTEM_PROMPT, '', knowledge].join('\n'))
    })

    it('知識＋引用脈絡並存 ⇒ 知識在前、引用在後', () => {
      const knowledge = '【清微旅行沉澱問答】\nQ：q\nA：a'
      const prompt = buildPartnerGroupSystemPrompt(
        { ...makeInput(), quotedBotContent: '之前的草稿' },
        knowledge
      )
      expect(prompt.indexOf(knowledge)).toBeGreaterThan(-1)
      expect(prompt.indexOf(knowledge)).toBeLessThan(prompt.indexOf('【引用脈絡】'))
      expect(prompt).toContain('「之前的草稿」')
    })

    it('純引用、無知識 ⇒ 輸出與現行 quote 版 byte-identical（迴歸鎖）', () => {
      const prompt = buildPartnerGroupSystemPrompt({
        ...makeInput(),
        quotedBotContent: '大車後排放球袋比較穩',
      })
      expect(prompt).toBe(
        [
          PARTNER_GROUP_SYSTEM_PROMPT,
          '',
          '【引用脈絡】使用者引用了你之前說的這句話，他的訊息是針對這句的回應；解讀口語、代稱與省略時，以這段引用為脈絡：',
          '「大車後排放球袋比較穩」',
        ].join('\n')
      )
    })
  })

  // 2026-06-13 外部佐證刀（刀2）: 搜證條款只在 web_search 閘開時注入；
  // 閘關 ⇒ 與現行 byte-identical（tripwire）。順序：persona → 知識 → 搜證 → 引用。
  describe('buildPartnerGroupSystemPrompt — 外部佐證刀搜證條款（tripwire）', () => {
    it('未開閘（省略 / false）⇒ 與現行 byte-identical，絕無搜證字樣', () => {
      expect(buildPartnerGroupSystemPrompt(makeInput())).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
      expect(
        buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: false })
      ).toBe(PARTNER_GROUP_SYSTEM_PROMPT)
    })

    it('開閘 ⇒ frozen persona 開頭＋搜證條款各句逐字在場（任一句被刪即炸）', () => {
      const prompt = buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: true })
      expect(prompt.startsWith(PARTNER_GROUP_SYSTEM_PROMPT)).toBe(true)
      expect(prompt).toContain('【外部佐證｜web_search 已開啟】')
      expect(prompt).toContain('本區塊優先於前面「不得聲稱你已查到任何即時資料」與「我目前還不能上網即時查資料」兩條')
      expect(prompt).toContain('實質問題（景點開放時間、節慶日期、交通、票價、規定等）內部知識不足時，必須用 web_search 查公開網頁')
      expect(prompt).toContain('回覆格式：先給結論，再列來源連結，文末固定加一句「以上為網路資料供參考，重要細節建議再與導遊確認」')
      expect(prompt).toContain('內部沉澱案例優先：沉澱知識已有答案時以內部為準，web 結果只佐證不覆蓋')
      expect(prompt).toContain('閒聊、寒暄、內部既有規則可答的問題不要搜尋 — 每次搜尋都是真實花費')
      expect(prompt).toContain('搜不到就誠實說搜不到，絕不腦補來源、絕不編造連結')
    })

    // 2026-06-13 (Eric Q3 拍板): 明確超出清邁範圍（其他城市）的問題，開閘時
    // 解除 frozen persona 的「不得以其他城市回答」硬鎖，可用 web 結果回答並標明
    // 非專營範圍。閘關時此條款不存在（沿用前面 byte-identical tripwire）。
    it('開閘 ⇒ 明確超出清邁範圍的問題可用 web 回答並標明非專營範圍（解除其他城市硬鎖）', () => {
      const prompt = buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: true })
      expect(prompt).toContain('明確超出清邁範圍')
      expect(prompt).toContain('非清微旅行專營範圍')
    })

    // 2026-06-13 (Eric Q3 補強): 超範圍題要「直接給實質答案」，不要婉拒丟谷歌；
    // 若對方要排行程，一樣吐 customer_itinerary_v1 格式。
    it('開閘 ⇒ 超範圍題要直接回答、不丟谷歌，要排行程一樣輸出 v1', () => {
      const prompt = buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: true })
      expect(prompt).toContain('不要只叫對方')
      expect(prompt).toContain('一樣用上面 customer_itinerary_v1')
    })

    // 2026-06-14 (Eric 拍板): 夥伴群是內部群，成員是夥伴不是客人；客人問到夜生活/
    // 成人場所等合法公開營業資訊時，一律照查照整理完整回群，不自我審查、不以「不適合」
    // 婉拒。閘關時此條款不存在（沿用 byte-identical tripwire）。
    it('開閘 ⇒ 成人/敏感類合法公開資訊照查照給、不自我審查、不婉拒', () => {
      const prompt = buildPartnerGroupSystemPrompt(makeInput(), null, { webSearchEnabled: true })
      expect(prompt).toContain('成人場所')
      expect(prompt).toContain('不要自我審查')
      expect(prompt).toContain('夥伴需要完整資訊')
    })

    it('順序：知識區塊在搜證條款之前、引用脈絡在最後', () => {
      const prompt = buildPartnerGroupSystemPrompt(
        { ...makeInput(), quotedBotContent: '昨天那個草稿' },
        '【清微旅行沉澱問答】\nQ：q\nA：a',
        { webSearchEnabled: true }
      )
      const knowledgeAt = prompt.indexOf('【清微旅行沉澱問答】')
      const searchAt = prompt.indexOf('【外部佐證｜web_search 已開啟】')
      const quotedAt = prompt.indexOf('【引用脈絡】')
      expect(knowledgeAt).toBeGreaterThan(-1)
      expect(searchAt).toBeGreaterThan(knowledgeAt)
      expect(quotedAt).toBeGreaterThan(searchAt)
    })
  })
})
