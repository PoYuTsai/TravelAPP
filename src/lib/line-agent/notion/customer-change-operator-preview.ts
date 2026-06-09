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

/**
 * One labelled block per declined activity so Eric can judge at a glance:
 *   原需求 / 否決原因 / 是否代入 draft / 替代候選 / 來源 case
 * Each block is a single multi-line array element (callers can join with a blank
 * line). Internal-only: theme, source and candidate counts are fine to show.
 */
export function buildOperatorRetrievalPreview(applications: RetrievalApplication[]): string[] {
  return applications.map((app) => {
    const theme = app.themeTag ?? '未指定'
    const reason = app.declineReason ? `長輩不適合（${app.declineReason}）` : '長輩不適合'
    const candidateList =
      app.candidates.length > 0
        ? `${app.candidates.map((c) => c.name).join('、')}（共 ${app.candidates.length} 筆，皆來自 retrieval 白名單）`
        : '無'

    const lines = [
      `Day ${app.day}｜原需求「${app.declinedActivity}」`,
      `　否決原因：${reason}`,
    ]

    if (app.outcome === 'substituted' && app.chosen) {
      lines.push('　是否代入 draft：是')
      lines.push(`　代入替代：${app.chosen.name}`)
      lines.push(`　替代候選：${candidateList}`)
      lines.push(`　來源 case：${app.chosen.name}（theme=${app.chosen.themeTag ?? theme}）`)
    } else if (app.outcome === 'named_only') {
      lines.push('　是否代入 draft：否（僅建議，待人工挑選代入）')
      lines.push(`　替代候選：${candidateList}`)
      // M3.4a: when the candidates are Notion-live theme signals (no concrete
      // attraction name), say so explicitly — they are policy-barred from the
      // draft, so the operator knows to fill in a real attraction by hand.
      if (app.candidates.some((c) => c.provenance === 'live_masked')) {
        lines.push(`　來源 case：Notion live（masked，僅 theme=${theme} 訊號，無景點名，依政策不代入）`)
      } else {
        lines.push(`　來源 case：— （theme=${theme} 未對齊或未指定）`)
      }
    } else {
      lines.push('　是否代入 draft：否')
      lines.push(`　替代候選：${candidateList}`)
      lines.push('　來源 case：無可用 retrieval 白名單，請人工補景點（系統不杜撰）')
    }

    return lines.join('\n')
  })
}
