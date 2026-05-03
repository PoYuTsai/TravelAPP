import type { MatchedActivity } from '@/lib/itinerary'

export interface ActivityTicketLike {
  id: string
  name: string
  price: number
  childPrice?: number
  rebate: number
  split: boolean
  checked: boolean
  dayNumber?: number
  source: 'parsed' | 'manual' | 'default'
  exclusiveGroup?: string
  priceNote?: string
  adultCount?: number
  childCount?: number
  adultPriceOverride?: number
  childPriceOverride?: number
}

function normalizeActivityId(id: string): string {
  return id.replace(/[-_\s]/g, '').toLowerCase()
}

function normalizeActivityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(票券|活動|代訂)\s*[｜|]\s*/, '')
    .replace(/\s+/g, '')
}

function getTicketTemplate<T extends ActivityTicketLike>(
  matched: MatchedActivity,
  defaultTickets: T[]
): T | undefined {
  const matchedId = normalizeActivityId(matched.activityId)
  const exactIdMatch = defaultTickets.find((ticket) => normalizeActivityId(ticket.id) === matchedId)
  if (exactIdMatch) return exactIdMatch

  const matchedName = normalizeActivityName(matched.activityName)
  return defaultTickets.find((ticket) => normalizeActivityName(ticket.name) === matchedName)
}

function getDedupKey(ticket: Pick<ActivityTicketLike, 'name' | 'dayNumber'>): string {
  return `${ticket.dayNumber || 0}:${normalizeActivityName(ticket.name)}`
}

function getMatchedFallbackTicket(matched: MatchedActivity): ActivityTicketLike {
  return {
    id: matched.activityId,
    name: matched.activityName,
    price: matched.price,
    rebate: matched.rebate,
    split: matched.splitRebate,
    checked: true,
    dayNumber: matched.dayNumber,
    source: 'parsed',
    exclusiveGroup: matched.exclusiveGroup,
  }
}

export function buildParsedActivityTickets<T extends ActivityTicketLike>(
  matches: MatchedActivity[],
  defaultTickets: T[]
): T[] {
  const dynamicTickets: T[] = []
  const addedGroups = new Set<string>()
  const addedTickets = new Set<string>()

  for (const matched of matches) {
    const template = getTicketTemplate(matched, defaultTickets)

    if (template?.exclusiveGroup) {
      const groupKey = `${matched.dayNumber}:${template.exclusiveGroup}`
      if (addedGroups.has(groupKey)) continue
      addedGroups.add(groupKey)

      const groupTickets = defaultTickets.filter((ticket) => ticket.exclusiveGroup === template.exclusiveGroup)
      groupTickets.forEach((groupTicket) => {
        const parsedTicket = {
          ...groupTicket,
          dayNumber: matched.dayNumber,
          source: 'parsed',
          checked: groupTicket.id === template.id,
        } as T
        dynamicTickets.push(parsedTicket)
        addedTickets.add(getDedupKey(parsedTicket))
      })
      continue
    }

    const parsedTicket = template
      ? ({
          ...template,
          dayNumber: matched.dayNumber,
          source: 'parsed',
          checked: true,
        } as T)
      : (getMatchedFallbackTicket(matched) as T)

    const dedupKey = getDedupKey(parsedTicket)
    if (addedTickets.has(dedupKey)) continue

    dynamicTickets.push(parsedTicket)
    addedTickets.add(dedupKey)
  }

  return dynamicTickets.sort((a, b) => (a.dayNumber || 0) - (b.dayNumber || 0))
}
