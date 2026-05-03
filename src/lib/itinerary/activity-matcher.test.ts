import { describe, expect, it } from 'vitest'

import {
  matchActivitiesToDatabase,
  type ActivityRecord,
} from './activity-matcher'
import { parseItineraryText } from './parse-itinerary-with-fallback'
import type { ParseResult } from './types'

function activity(overrides: Partial<ActivityRecord> & Pick<ActivityRecord, '_id' | 'name'>): ActivityRecord {
  return {
    keywords: [],
    activityType: 'ticket',
    adultPrice: 0,
    rebate: 0,
    splitRebate: false,
    isActive: true,
    ...overrides,
  }
}

function parseResult(lines: string[]): ParseResult {
  return {
    success: true,
    errors: [],
    warnings: [],
    year: 2026,
    days: [
      {
        date: '2026-08-17',
        dayNumber: 1,
        title: '測試行程',
        morning: lines.join('\n'),
        afternoon: '',
        evening: '',
        activities: lines.map((content) => ({ content })),
        rawText: lines.join('\n'),
      },
    ],
  }
}

describe('activity matcher', () => {
  it('ignores elephant homestay notes while matching elephant poop paper park', () => {
    const result = matchActivitiesToDatabase(
      parseResult([
        '返回大象民宿',
        '備註：早點起來大象叫澡 + 用早餐',
        '大象便便造紙公園',
      ]),
      [
        activity({
          _id: 'elephant',
          name: '大象保護營（不含餐）',
          keywords: ['大象', '保護營'],
          adultPrice: 1600,
        }),
        activity({
          _id: 'elephantPoop',
          name: '大象粑粑造紙公園',
          keywords: ['粑粑', '便便', '造紙', '大象便便'],
          adultPrice: 200,
        }),
      ]
    )

    expect(result.matched.map((match) => match.activityId)).toEqual(['elephantPoop'])
  })

  it('matches booking items from custom ticket names even when keyword list is empty', () => {
    const result = matchActivitiesToDatabase(
      parseResult(['客人搭乘曼谷－清邁夜火車 二等臥鋪冷氣 下鋪抵達清邁']),
      [
        activity({
          _id: 'custom-train-lower',
          name: '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 下鋪',
          adultPrice: 1041,
        }),
      ]
    )

    expect(result.matched.map((match) => match.activityName)).toEqual([
      '代訂｜曼谷－清邁夜火車 二等臥鋪冷氣 下鋪',
    ])
  })

  it('matches Lampang carriage and temple plus Doi Inthanon ticket keywords', () => {
    const result = matchActivitiesToDatabase(
      parseResult([
        '茵他儂國家公園主峰與雙龍塔',
        '南邦馬車遊城 5公里（Museum Lampang 上車）',
        '南邦鑾寺 Wat Phra That Lampang Luang',
      ]),
      [
        activity({
          _id: 'doiInthanon',
          name: '茵他儂國家公園門票',
          keywords: ['茵他儂', '茵他儂國家公園'],
          adultPrice: 300,
        }),
        activity({
          _id: 'twoChedis',
          name: '國王皇后雙塔',
          keywords: ['雙龍塔', '雙塔', '國王皇后雙塔'],
          adultPrice: 100,
        }),
        activity({
          _id: 'lampangHorseCarriage5km',
          name: '活動｜南邦馬車遊城 5公里',
          keywords: ['南邦馬車遊城', '馬車遊城', '5公里'],
          adultPrice: 400,
        }),
        activity({
          _id: 'lampangLuangTemple',
          name: '南邦鑾寺',
          keywords: ['南邦鑾寺', 'Wat Phra That Lampang Luang'],
          adultPrice: 40,
        }),
      ]
    )

    expect(result.matched.map((match) => match.activityId)).toEqual([
      'doiInthanon',
      'twoChedis',
      'lampangHorseCarriage5km',
      'lampangLuangTemple',
    ])
  })

  it('matches Eric revised 2026/8/17 itinerary without selecting elephant camp', () => {
    const itinerary = `日期：2026/8/17~2026/8/20
人數: 共10位 7個大人，3個小孩（8y、5y、3y)
車數: 2台
導遊: 1位

8/17（一）
Day 1｜清邁火車站接站 + 茵他儂國家公園
**早上清邁火車站接站**
(8/16 從曼谷搭夜火車，預計 8/17 早上抵達清邁)
・茵他儂國家公園主峰與雙龍塔
・Ban Mae Klang Luang 卡倫族社區生態村
・午餐：苗族市場用餐
・參觀苗族市場
・The Garden Inthanon Cafe'
・瓦吉拉瀑布
返回大象民宿
住宿：Tawan Riverside - Elephant Resort

8/18（二）
Day 2｜漫遊清邁古城 + 夜間動物園
**9:00 出發**
備註：早點起來大象叫澡 + 用早餐，營區內跟大象體驗互動拍照
~悠閒回清邁市區，古城逛逛~
・泰服體驗 1 小時，請專業攝影師拍攝（古城塔佩門 / 柴迪隆寺）
午餐：Neng’s Clay Oven Roasted Pork – Muang Mai Market（清邁必吃脆皮豬）
・逛Big C/按摩
・夜間動物園 (16:30抵達看表演秀)
晚餐：黑森林餐廳
住宿：清邁包棟villa

8/19（三）
Day 3｜湄林活動體驗一日
**9:00 出發**
・大象便便造紙公園
・鳳凰冒險公園 Phoenix Adventure Park（比較不刺激，適合帶小朋友）
午餐：Mai Heun 60
・黏黏瀑布
晚餐：Kung Yim Shop (2nd Branch) 泰國蝦吃到飽
住宿：清邁包棟villa

8/20（四）
Day 4｜南邦一日
**9:00 出發**
・南邦馬車遊城（Museum Lampang 上車，可依需求選 3公里 / 5公里 / 包車自由路線）
・南邦鑾寺 Wat Phra That Lampang Luang
住宿：清邁包棟villa`

    const result = matchActivitiesToDatabase(
      parseItineraryText(itinerary, 2026),
      [
        activity({
          _id: 'elephant',
          name: '大象保護營（不含餐）',
          keywords: ['大象保護營', '象營', 'elephant camp', '保護營', '湄登', '不含餐'],
          adultPrice: 1600,
        }),
        activity({
          _id: 'elephantPoop',
          name: '大象粑粑造紙公園',
          keywords: ['粑粑', '便便', '造紙', '大象便便'],
          adultPrice: 200,
        }),
        activity({
          _id: 'nightSafari',
          name: '夜間動物園',
          keywords: ['夜間動物園', 'night safari', '動物園'],
          adultPrice: 1200,
        }),
        activity({
          _id: 'doiInthanon',
          name: '茵他儂國家公園門票',
          keywords: ['茵他儂', '茵他儂國家公園', '主峰'],
          adultPrice: 300,
        }),
        activity({
          _id: 'twoChedis',
          name: '國王皇后雙塔',
          keywords: ['雙龍塔', '雙塔', '國王皇后雙塔'],
          adultPrice: 100,
        }),
        activity({
          _id: 'phoenixPark',
          name: '鳳凰冒險公園',
          keywords: ['鳳凰', 'phoenix', '冒險公園', 'adventure park'],
          adultPrice: 90,
        }),
        activity({
          _id: 'lampangHorseCarriage5km',
          name: '活動｜南邦馬車遊城 5公里',
          keywords: ['南邦馬車遊城', '馬車遊城', '5公里'],
          adultPrice: 400,
        }),
        activity({
          _id: 'lampangLuangTemple',
          name: '南邦鑾寺',
          keywords: ['南邦鑾寺', 'Wat Phra That Lampang Luang'],
          adultPrice: 40,
        }),
      ]
    )

    expect(result.matched.map((match) => match.activityId)).toEqual(
      expect.arrayContaining([
        'doiInthanon',
        'twoChedis',
        'nightSafari',
        'elephantPoop',
        'phoenixPark',
        'lampangHorseCarriage5km',
        'lampangLuangTemple',
      ])
    )
    expect(result.matched.map((match) => match.activityId)).not.toContain('elephant')
  })
})
