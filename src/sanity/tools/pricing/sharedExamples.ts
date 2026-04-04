import type { PricingCalculatorVariant } from './variants'

export interface PricingExampleDocument<TData = unknown> {
  _id: string
  _type: 'pricingExample'
  name: string
  variant: PricingCalculatorVariant
  createdAt: string
  updatedAt: string
  createdByName?: string
  createdByEmail?: string
  itineraryPreview?: string
  payload: string
  _createdAt?: string
  _updatedAt?: string
}

export interface SavedQuoteRecord<TData = unknown> {
  id: string
  name: string
  createdAt: string
  updatedAt?: string
  createdByName?: string
  createdByEmail?: string
  data: TData
}

type PricingExampleAuthor = {
  name?: string | null
  email?: string | null
}

export function getPricingExampleDocumentId(
  variant: PricingCalculatorVariant,
  quoteId: string
) {
  return `pricingExample.${variant}.${quoteId}`
}

export function getPricingExamplePreview(itineraryText: string) {
  return itineraryText
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export function buildPricingExampleDocument<TData extends { itineraryText?: string }>(
  variant: PricingCalculatorVariant,
  quote: SavedQuoteRecord<TData>,
  author?: PricingExampleAuthor
): PricingExampleDocument<TData> {
  const timestamp = quote.updatedAt ?? quote.createdAt

  return {
    _id: getPricingExampleDocumentId(variant, quote.id),
    _type: 'pricingExample',
    name: quote.name,
    variant,
    createdAt: quote.createdAt,
    updatedAt: timestamp,
    createdByName: author?.name?.trim() || quote.createdByName || undefined,
    createdByEmail: author?.email?.trim().toLowerCase() || quote.createdByEmail || undefined,
    itineraryPreview: getPricingExamplePreview(quote.data.itineraryText ?? ''),
    payload: JSON.stringify(quote.data),
  }
}

export function parsePricingExampleDocument<TData>(
  doc: PricingExampleDocument<TData>
): SavedQuoteRecord<TData> | null {
  try {
    const data = JSON.parse(doc.payload) as TData

    return {
      id: doc._id.split('.').slice(2).join('.') || doc._id,
      name: doc.name,
      createdAt: doc.createdAt || doc._createdAt || new Date().toISOString(),
      updatedAt: doc.updatedAt || doc._updatedAt || doc.createdAt || doc._createdAt,
      createdByName: doc.createdByName,
      createdByEmail: doc.createdByEmail,
      data,
    }
  } catch {
    return null
  }
}

export function mergeSavedQuoteRecords<TData>(
  primary: SavedQuoteRecord<TData>[],
  secondary: SavedQuoteRecord<TData>[]
) {
  const merged = new Map<string, SavedQuoteRecord<TData>>()

  for (const quote of [...primary, ...secondary]) {
    if (!merged.has(quote.id)) {
      merged.set(quote.id, quote)
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aTime = Date.parse(a.updatedAt ?? a.createdAt)
    const bTime = Date.parse(b.updatedAt ?? b.createdAt)
    return bTime - aTime
  })
}
