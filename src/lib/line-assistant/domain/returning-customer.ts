import type { ReturningCustomerHint } from '../types'

export interface ReturningCustomerMatchCandidate {
  recordId: string
  score: number
  inquiryDate?: string
}

export function buildReturningCustomerHint(input: {
  hasSeenBeforeInSystem: boolean
  matches: ReturningCustomerMatchCandidate[]
}): ReturningCustomerHint {
  const [bestMatch] = [...input.matches].sort((a, b) => b.score - a.score)

  let notionMatchConfidence: ReturningCustomerHint['notionMatchConfidence'] = 'none'

  if (bestMatch) {
    if (bestMatch.score >= 0.85) {
      notionMatchConfidence = 'high'
    } else if (bestMatch.score >= 0.65) {
      notionMatchConfidence = 'medium'
    } else {
      notionMatchConfidence = 'low'
    }
  }

  return {
    hasSeenBeforeInSystem: input.hasSeenBeforeInSystem,
    notionMatchConfidence,
    matchedNotionRecordIds: input.matches.map((match) => match.recordId),
    previousInquiryDate: bestMatch?.inquiryDate,
  }
}
