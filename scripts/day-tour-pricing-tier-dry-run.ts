import { createClient } from 'next-sanity'
import {
  DAY_TOUR_ROUTE_TIER_PROPOSALS,
  proposeDayTourPricingTier,
} from '../src/lib/pricing/dayTourPricing'

interface DayTourPricingDocument {
  _id: string
  title?: string | null
  slug?: string | null
  pricingTier?: string | null
  basePrice?: number | null
  priceUnit?: string | null
  priceNote?: string | null
  guidePrice?: number | null
}

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || 'production'

if (!projectId) {
  throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID')
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  useCdn: false,
  perspective: 'published',
})

const query = `*[_type == "dayTour"] | order(order asc) {
  _id,
  title,
  "slug": slug.current,
  pricingTier,
  basePrice,
  priceUnit,
  priceNote,
  guidePrice
}`

async function main() {
  const documents = await client.fetch<DayTourPricingDocument[]>(query)
  const seenRoutes = new Set<string>()
  let needsManualReview = false

  const rows = documents.map((document) => {
    const proposal = proposeDayTourPricingTier(document)

    if (proposal.status === 'manual' || seenRoutes.has(proposal.route)) {
      needsManualReview = true
    } else {
      seenRoutes.add(proposal.route)
    }

    const proposedTier = proposal.proposedTier ?? 'MANUAL'
    const currentTier = document.pricingTier ?? 'unset'

    return {
      _id: document._id,
      title: document.title ?? '',
      slug: document.slug ?? '',
      currentTier,
      basePrice: document.basePrice ?? '',
      priceUnit: document.priceUnit ?? '',
      priceNote: document.priceNote ?? '',
      guidePrice: document.guidePrice ?? '',
      proposedTier,
      diff: proposal.status === 'manual'
        ? 'MANUAL REVIEW'
        : currentTier === proposal.proposedTier
          ? 'unchanged'
          : `${currentTier} -> ${proposal.proposedTier}`,
    }
  })

  const missingRoutes = DAY_TOUR_ROUTE_TIER_PROPOSALS
    .map(({ route }) => route)
    .filter((route) => !seenRoutes.has(route))

  if (documents.length !== DAY_TOUR_ROUTE_TIER_PROPOSALS.length || missingRoutes.length > 0) {
    needsManualReview = true
  }

  console.log(`Day-tour pricing tier dry-run (READ ONLY): ${projectId}/${dataset}`)
  console.table(rows)
  console.log(`Documents: ${documents.length}; expected routes: ${DAY_TOUR_ROUTE_TIER_PROPOSALS.length}`)
  if (missingRoutes.length > 0) console.log(`Missing routes: ${missingRoutes.join(', ')}`)

  if (needsManualReview) {
    console.error('Manual review required; no data was written.')
    process.exitCode = 1
  } else {
    console.log('All six known routes have deterministic proposals; no data was written.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
