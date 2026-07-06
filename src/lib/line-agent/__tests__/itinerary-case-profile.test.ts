/**
 * itinerary-case-profile.test.ts — 合併刀（M-2）的本案 profile 推導器。
 *
 * deriveCaseProfile 從一則鬆散的夥伴群對話文字，抽出 gate per-case lint 需要的
 * 子集（mobility / stayArea / sameLodgingAllTrip / knownFlight）。設計鐵律：
 *  - 高訊號才設欄位；抽不到的欄位一律「不設」（gate 回退中性，no-profile 路徑零變化）。
 *  - knownFlight 走**保守**門檻（明確航班碼/航空＋明確抵達時刻才設），因為 gate 的
 *    redundant_flight_confirm 是 error 規則：誤設 ⇒ 把合法「待確認航班」草稿錯擋。
 *    （航班真相長線收斂進 Task 8 航班時刻表 RAG — 見計畫 item7。）
 *  - 全抽不到 ⇒ 回 null（responder 端 reference.profile = null，gate 走中性）。
 */
import { describe, expect, it } from 'vitest'
import { deriveCaseProfile } from '../notion/itinerary-case-profile'

describe('deriveCaseProfile — mobility', () => {
  it('輪椅 / 行動不便 ⇒ limited mobility（substring 觸發 Rules 8-9）', () => {
    expect(deriveCaseProfile('長輩坐輪椅，麻煩排無障礙')?.mobility?.type).toMatch(
      /limited|wheelchair/
    )
    expect(deriveCaseProfile('媽媽行動不便，走不遠')?.mobility?.type).toMatch(
      /limited|wheelchair/
    )
  })

  it('只提「長輩同行」不算行動不便（保守：避免誤觸 mobility 規則）', () => {
    // 無任何訊號 ⇒ 整體回 null（mobility 自然不存在）。
    expect(deriveCaseProfile('有兩位長輩同行，想輕鬆一點')?.mobility).toBeUndefined()
  })
})

describe('deriveCaseProfile — stayArea / sameLodgingAllTrip', () => {
  it('古城 / old city ⇒ stayArea=chiangmai_old_city（唯一有 lodging 規則的 canonical key）', () => {
    expect(deriveCaseProfile('住在古城裡比較方便')?.stayArea).toBe('chiangmai_old_city')
    expect(deriveCaseProfile('hotel in the old city please')?.stayArea).toBe(
      'chiangmai_old_city'
    )
  })

  it('全程同住 / 不換飯店 ⇒ sameLodgingAllTrip=true', () => {
    expect(deriveCaseProfile('全程住同一間飯店，不想換來換去')?.sameLodgingAllTrip).toBe(true)
    expect(deriveCaseProfile('整趟都不換飯店')?.sameLodgingAllTrip).toBe(true)
  })

  it('沒提住宿區域/換宿 ⇒ 兩欄都不設', () => {
    const p = deriveCaseProfile('排個五天四夜清邁親子行程')
    expect(p?.stayArea).toBeUndefined()
    expect(p?.sameLodgingAllTrip).toBeUndefined()
  })
})

describe('deriveCaseProfile — knownFlight（保守）', () => {
  it('明確航班碼＋抵達時刻 ⇒ 設 knownFlight', () => {
    const p = deriveCaseProfile('我們搭華航 CI851，下午 15:30 抵達清邁')
    expect(p?.knownFlight).toBeDefined()
    expect(p?.knownFlight?.airline).toMatch(/CI851|華航/)
    expect(p?.knownFlight?.arrivalTime).toMatch(/15:30|15：30/)
  })

  it('只說「航班待確認 / 還沒訂機票」⇒ 不設 knownFlight（否則錯擋待確認草稿）', () => {
    expect(deriveCaseProfile('機票還沒訂，航班待確認')?.knownFlight).toBeUndefined()
    expect(deriveCaseProfile('還在看機票')?.knownFlight).toBeUndefined()
  })

  it('有航班碼但無抵達時刻 ⇒ 不設（保守：時刻不明不臆造）', () => {
    expect(deriveCaseProfile('大概是長榮 BR257')?.knownFlight).toBeUndefined()
  })
})

describe('deriveCaseProfile — 全抽不到回 null', () => {
  it('一般閒聊 / 無任何 profile 訊號 ⇒ null', () => {
    expect(deriveCaseProfile('你好，請問可以幫忙規劃嗎？')).toBeNull()
    expect(deriveCaseProfile('')).toBeNull()
  })
})
