/**
 * Fixture pages keyed by Eric's REAL 2026 private Notion column names.
 *
 * Unlike __fixtures__/pages.ts (placeholder aliases), these use the actual
 * column labels the live private_2026 database exposes — so the alias-alignment
 * knife can prove the adapter maps real names → facts / privateContext without
 * ever touching the network, a real db id, or dumping a real customer row.
 *
 * Real columns covered:
 *   旅遊日期   → travelDateRange
 *   旅遊人數   → partySize (+ adults/children when the text breaks them down)
 *   飛行班次   → facts.flightInfo (raw text, partner-safe)
 *   包車車型   → facts.vehicleType (raw text, partner-safe)
 *   行程框架   → itinerarySnippet (searchable text)
 *   總成本/總收入/利潤 → privateContext only; NEVER partner-facing
 *
 * Notably ABSENT: any explicit 城市區域 / 行程類型 column. area/theme tokens are
 * therefore expected to stay empty for this corpus — they are a later parser's
 * job (extract from 行程框架), NOT something this knife invents.
 */

import type { NotionPageFixture } from '../types'

/** Non-secret stand-in id; the real db id never appears in code or tests. */
export const REAL_2026_FIXTURE_DATABASE_ID = 'db_private_2026_fixture'

const DB = REAL_2026_FIXTURE_DATABASE_ID

export const REAL_2026_FIXTURE_PAGES: NotionPageFixture[] = [
  // 1. 親子家庭 — party text breaks down into 成人 + 小朋友
  {
    id: 'real-family-cm-5d',
    databaseId: DB,
    properties: {
      旅遊日期: '4/12-4/16',
      旅遊人數: '成人2 小朋友2',
      飛行班次: 'TG635 抵 0815 / TG636 離 2350',
      包車車型: 'Alphard 大車 *1 + 中文導遊 *1',
      行程框架: '清邁親子 5 天：動物園 + 叢林飛索 + 夜間動物園 + 大象保護營',
      總成本: 22000,
      總收入: 30000,
      利潤: 8000,
      客人姓名: '王先生',
    },
  },

  // 2. 純成人 — party text only carries 成人N (no children)
  {
    id: 'real-couple-honeymoon',
    databaseId: DB,
    properties: {
      旅遊日期: '5/1-5/3',
      旅遊人數: '成人2',
      飛行班次: 'VZ112 抵 1230',
      包車車型: 'Commuter 小車 *1',
      行程框架: '清邁蜜月 3 天：咖啡廳 + 按摩 + 浪漫晚餐',
      總成本: 11000,
      總收入: 14500,
      利潤: 3500,
      客人姓名: '李小姐',
    },
  },

  // 3. 只有總人數 — "N人", no adult/child breakdown
  {
    id: 'real-photo-tour',
    databaseId: DB,
    properties: {
      旅遊日期: '6/10-6/12',
      旅遊人數: '3人',
      飛行班次: 'IT512 抵 0930',
      包車車型: '6人座包車',
      行程框架: '清邁網美拍照 3 天：藍廟 + 茵他儂 + 藝術村',
    },
  },
]
