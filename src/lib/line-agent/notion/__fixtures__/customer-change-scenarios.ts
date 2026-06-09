/**
 * customer-change-scenarios.ts
 *
 * M3.3e — realistic customer-change scenario fixtures for the deterministic
 * change composer. Each builder returns a ready ChangeComposerInput (base +
 * changes + simulated retrievalCases) modelling a real Chiang Mai request Eric
 * gets. Retrieval cases are SIMULATED here — no Notion live. These pin the
 * composer's behaviour and the customerExplanation tone against regressions.
 */

import type { ChangeComposerInput } from '../customer-itinerary-change-composer'
import { LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS } from './customer-itinerary-golden'

function base(): ChangeComposerInput['base'] {
  return JSON.parse(JSON.stringify(LI_FAMILY_ELDERLY_CHIANGMAI_REQUIREMENTS))
}

/** 1. 長輩體力變差 — customer reports the elder can walk even less now. */
export function scenarioMobilityDowngrade(): ChangeComposerInput {
  return {
    base: base(),
    changes: {
      mobilityDowngrade: {
        type: 'limited_mobility_wheelchair_assisted',
        canWalkHoursPerDay: [0, 1],
        canSelfBoardVehicle: true,
      },
    },
  }
}

/** 2. 客人臨時想加刺激景點 — declined for mobility, substituted from whitelist. */
export function scenarioAddThrillActivity(): ChangeComposerInput {
  return {
    base: base(),
    changes: { addActivities: [{ day: 3, activity: '叢林飛索體驗', themeTag: 'adventure' }] },
    retrievalCases: [
      { name: '湄登大象友善半日（緩坡步道）', themeTag: 'adventure', mobilityFriendly: true },
    ],
  }
}

/** 3. 末日送機仍想吃飯 — final-day morning transfer strips the requested meal. */
export function scenarioFinalDayStillWantsLunch(): ChangeComposerInput {
  const b = base()
  b.requirements.days[6].lunch = '機場附近午餐'
  b.requirements.days[6].dinner = '最後一晚泰式料理'
  b.requirements.days[6].lodging = '清邁古城民宿'
  return {
    base: b,
    changes: { finalDayMorningTransfer: { time: '09:30' } },
  }
}

/** 4. 同住古城但想跑清萊 — lodging change declined, day-trip advised. */
export function scenarioSameLodgingButChiangRai(): ChangeComposerInput {
  return {
    base: base(),
    changes: {
      sameLodgingAllTrip: { stayArea: 'chiangmai_old_city' },
      lodgingChangeRequests: [{ day: 4, lodging: '清萊白廟旁民宿' }],
    },
  }
}

/** 5. 保留天使瀑布 — protected from removal even when a remove is requested. */
export function scenarioKeepTianshiWaterfall(): ChangeComposerInput {
  return {
    base: base(),
    changes: {
      keepActivities: ['天使瀑布'],
      removeActivities: [{ day: 3, activity: '天使瀑布' }],
    },
  }
}

export const ALL_CHANGE_SCENARIOS: Array<{ name: string; build: () => ChangeComposerInput }> = [
  { name: '長輩體力變差', build: scenarioMobilityDowngrade },
  { name: '客人臨時想加刺激景點', build: scenarioAddThrillActivity },
  { name: '末日送機仍想吃飯', build: scenarioFinalDayStillWantsLunch },
  { name: '同住古城但想跑清萊', build: scenarioSameLodgingButChiangRai },
  { name: '保留天使瀑布', build: scenarioKeepTianshiWaterfall },
]
