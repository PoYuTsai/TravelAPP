/**
 * Fixture pages for the Notion 2026 team-collaboration database (READ tests).
 *
 * These are minimal NotionPageFixture records (plain property values, NOT the
 * full Notion SDK envelope). They deliberately include sensitive fields
 * (成本/cost, 分潤/profitShare, 客人姓名/name) so policy tests can prove those
 * NEVER leak into partner or operator output.
 *
 * Property names use Chinese aliases that normalise to canonical fields via
 * FIELD_ALIASES — the real 2026 schema is not yet imported.
 */

import type { NotionPageFixture } from '../types'
import { TEAM_2026_FIXTURE_DATABASE_ID } from './team-2026-schema'

const DB = TEAM_2026_FIXTURE_DATABASE_ID

export const FIXTURE_PAGES: NotionPageFixture[] = [
  // 1. 親子 5 天清邁 — the canonical family target case (with full sensitive set)
  {
    id: 'case-family-cm-5d',
    databaseId: DB,
    properties: {
      日期: '4/12-4/16',
      天數: 5,
      人數: 4,
      大人: 2,
      小孩: 2,
      小孩年齡: [4, 7],
      城市區域: '清邁',
      行程類型: '親子',
      行程摘要: '清邁親子 5 天，動物園 + 叢林飛索 + 夜間動物園',
      景點餐廳: ['清邁夜間動物園', '叢林飛索', 'Ristr8to 咖啡'],
      車導配置: '司機 + 中文導遊分工',
      狀態: 'converted',
      特殊需求: '需兒童安全座椅 x2',
      內部備註: '客人很在意安全座椅，已確認車型 Alphard，partner 可參考此車適合親子家庭。',
      內部標籤: ['親子', '高滿意', '回頭客'],
      報價總額: 38000,
      成本: 22000,
      分潤: 8000,
      客人姓名: '王先生',
    },
  },

  // 2. 情侶蜜月 — couple, no children
  {
    id: 'case-couple-honeymoon',
    databaseId: DB,
    properties: {
      日期: '5/1-5/3',
      天數: 3,
      人數: 2,
      大人: 2,
      小孩: 0,
      城市區域: '清邁',
      行程類型: '蜜月',
      行程摘要: '清邁蜜月 3 天，咖啡廳 + 按摩 + 浪漫晚餐',
      景點餐廳: ['寧曼路咖啡', 'Lila Thai Massage', '契迪龍寺'],
      車導配置: '司機',
      狀態: 'converted',
      報價總額: 18000,
      成本: 11000,
      分潤: 3500,
      客人姓名: '李小姐',
    },
  },

  // 3. 純玩拍 — photo tour, no children, no sensitive cost/profit set (varied shape)
  {
    id: 'case-photo-tour',
    databaseId: DB,
    properties: {
      日期: '6/10-6/12',
      天數: 3,
      人數: 3,
      大人: 3,
      小孩: 0,
      城市區域: '清邁',
      行程類型: '拍攝',
      行程摘要: '清邁網美拍照 3 天',
      景點餐廳: ['藍廟', '茵他儂國家公園', 'Baan Kang Wat 藝術村'],
      車導配置: '司機 + 攝影協力',
      狀態: 'quoted_tracking',
      內部標籤: ['拍照'],
      報價總額: 25000,
    },
  },

  // 4. 親子 4 天清邁 — heavy sensitive set + long internal note (truncate test)
  {
    id: 'case-family-cm-4d',
    databaseId: DB,
    properties: {
      日期: '7/20-7/23',
      天數: 4,
      人數: 3,
      大人: 2,
      小孩: 1,
      小孩年齡: [5],
      城市區域: '清邁',
      行程類型: '親子',
      行程摘要: '清邁親子 4 天，大象保護營 + 手作體驗',
      景點餐廳: ['大象保護營', '清邁大學', '週日夜市'],
      車導配置: '司機 + 中文導遊',
      狀態: 'converted',
      特殊需求: '小孩會暈車',
      內部備註:
        '這團分潤特別高，partner 絕對不要看到任何金額或成本明細。客人是 Eric 舊識介紹，行程彈性大，出發前還改了兩次，車導都很配合，整體滿意度很高，值得列為重點回頭客名單持續追蹤後續行程需求。',
      內部標籤: ['親子', '高分潤'],
      報價總額: 32000,
      成本: 18000,
      分潤: 9000,
      客人姓名: '陳太太',
    },
  },
]
