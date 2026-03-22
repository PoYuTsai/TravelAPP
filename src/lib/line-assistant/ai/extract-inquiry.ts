import type { CustomerInquiry } from '../types'

function extractTravelDates(rawMessage: string): string | null {
  const rangeMatch = rawMessage.match(/(\d{1,2}\/\d{1,2}\s*[-~～]\s*\d{1,2})/)
  if (rangeMatch) {
    return rangeMatch[1].replace(/\s+/g, '')
  }

  return null
}

function extractAdults(rawMessage: string): number | null {
  const match = rawMessage.match(/(\d+)\s*大/)
  return match ? Number(match[1]) : null
}

function extractChildren(rawMessage: string): number | null {
  const match = rawMessage.match(/(\d+)\s*小/)
  return match ? Number(match[1]) : null
}

function extractAttractions(rawMessage: string): string[] {
  const knownAttractions = ['大象營', '夜間動物園', '清萊', '雙龍寺']
  return knownAttractions.filter((item) => rawMessage.includes(item))
}

function extractSpecialNeeds(rawMessage: string): string[] {
  const needs: string[] = []
  const seatMatch = rawMessage.match(/(\d+)\s*張?汽座/)
  if (seatMatch) {
    needs.push(`${seatMatch[1]}張汽座`)
  }
  return needs
}

export function extractInquiryFromMessage(input: {
  lineUserId: string
  customerName: string
  rawMessage: string
  sourceEventId: string
  timestamp: string
}): CustomerInquiry {
  return {
    id: `inq:${input.sourceEventId}`,
    sourceEventId: input.sourceEventId,
    lineUserId: input.lineUserId,
    customerName: input.customerName,
    hasSeenBeforeInSystem: false,
    notionMatchConfidence: 'none',
    matchedNotionRecordIds: [],
    travelDates: extractTravelDates(input.rawMessage),
    duration: null,
    adults: extractAdults(input.rawMessage),
    children: extractChildren(input.rawMessage),
    childrenAges: null,
    attractions: extractAttractions(input.rawMessage),
    budget: null,
    accommodation: null,
    specialNeeds: extractSpecialNeeds(input.rawMessage),
    inquiryType: 'new',
    urgency: 'normal',
    conversionSignal: false,
    rawMessage: input.rawMessage,
    rawMessagePreview: input.rawMessage.slice(0, 120),
    timestamp: input.timestamp,
  }
}
