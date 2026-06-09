/**
 * customer-change-operator-preview.ts
 *
 * M3.3d — Operator-facing preview of retrieval-case applications. PURE, NO LLM,
 * NO Notion live, NO LINE, NO gate. Renders the RetrievalApplication trace from
 * the change composer into short lines an operator (Eric) reads BEFORE sending
 * the customer draft, to confirm which alternative was applied or to fill in a
 * manual choice when the system has no whitelist candidate.
 *
 * This is internal-only output: unlike customerExplanation it MAY name the
 * source, theme and candidate count. It never invents an attraction — when there
 * is no usable candidate it explicitly hands the decision back to the operator.
 */

import type { RetrievalApplication } from './customer-itinerary-change-composer'

export function buildOperatorRetrievalPreview(applications: RetrievalApplication[]): string[] {
  return applications.map((app) => {
    const head = `Day ${app.day}｜原需求「${app.declinedActivity}」`
    const theme = app.themeTag ?? '未指定'
    if (app.outcome === 'substituted' && app.chosen) {
      return `${head} → 已代入同主題替代「${app.chosen.name}」（theme=${theme}；retrieval 白名單候選 ${app.candidates.length} 筆）`
    }
    if (app.outcome === 'named_only') {
      const names = app.candidates.map((c) => c.name).join('、')
      return `${head} → 未代入，建議候選：${names}（theme=${theme} 未對齊或未指定，需人工挑選代入）`
    }
    return `${head} → 無可用 retrieval 白名單替代，請人工補景點（系統不杜撰，theme=${theme}）`
  })
}
