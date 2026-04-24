# Quote Display Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive quote display page (`/quote/[slug]`) that replaces PDF downloads, using Claude Design visual style with dynamic Sanity data, supporting both a LINE OA showcase mode and customer-specific mode.

**Architecture:** Next.js Server Component fetches quote data from Sanity via `publicSlug`. Client components handle framer-motion animations. Smart inference converts `parsedItinerary.items[]` (plain strings) into structured timeline items with kind/icon/time. Photos stored in Sanity image assets, uploaded from PricingCalculator.

**Tech Stack:** Next.js 14 App Router, Sanity GROQ, Tailwind CSS, framer-motion, lucide-react

**Key Reference Files:**
- Claude Design HTML: `/mnt/c/Users/eric1/Downloads/Chiangmai_5D4N_Itinerary_v2.html`
- PricingCalculator: `src/sanity/tools/pricing/PricingCalculator.tsx`
- ExternalQuote: `src/sanity/tools/pricing/externalQuote.ts`
- QuoteDetails: `src/sanity/tools/pricing/quoteDetails.ts`
- Sanity Schema: `src/sanity/schemas/pricingExample.ts`

**Two Modes:**
- `/quote/sample` → Showcase for LINE OA rich menu (uses "清邁親子5天4夜經典套餐" Sanity doc)
- `/quote/[slug]` → Customer-specific with full pricing

---

## Phase 1: Backend Prep

### Task 1: Overtime Fee 200 → 300

Update overtime fee from 200 to 300 THB/hour across both v1 (legacy) and formal versions.

**Files:**
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`

**Step 1: Search and replace all overtime fee references**

Find all `200 泰銖/小時` and `200 THB` overtime references. Known locations:
- Line ~782: `200 泰銖/小時 × ${c.carCount}台車`
- Line ~3983: `超時費：200 泰銖/小時`
- Line ~4716-4717: `超時 200 泰銖/小時` (×2 for 清邁/清萊)
- Line ~5203: `200 泰銖/小時 × {calculation.carCount}台車`
- Line ~5701: `200 泰銖/小時 × {calculation.carCount} 台車`

Replace all `200` with `300` in overtime fee contexts only.

**Step 2: Verify no other 200 values were affected**

Search for remaining `200` in the file to confirm only overtime-related ones were changed.

**Step 3: Commit**

```bash
git add src/sanity/tools/pricing/PricingCalculator.tsx
git commit -m "fix: 超時費 200 → 300 泰銖/小時（v1 + 正式版）"
```

---

### Task 2: Sanity Schema — Add publicSlug & photos

**Files:**
- Modify: `src/sanity/schemas/pricingExample.ts`

**Step 1: Add `publicSlug` and `photos` fields to schema**

```typescript
// After existing fields, add:
{
  name: 'publicSlug',
  title: '公開連結代碼',
  type: 'slug',
  description: '報價展示頁的公開網址。產生後不要修改。',
  options: {
    source: 'name',
    maxLength: 12,
  },
},
{
  name: 'photos',
  title: '行程照片',
  type: 'array',
  description: '每日行程照片，每天最多 3 張',
  of: [
    {
      type: 'object',
      fields: [
        { name: 'dayIndex', title: '第幾天 (0-based)', type: 'number' },
        {
          name: 'images',
          title: '照片 (最多3張)',
          type: 'array',
          of: [{ type: 'image', options: { hotspot: true } }],
          validation: (Rule: any) => Rule.max(3),
        },
      ],
    },
  ],
},
```

**Step 2: Commit**

```bash
git add src/sanity/schemas/pricingExample.ts
git commit -m "feat: pricingExample schema 加 publicSlug + photos 欄位"
```

---

### Task 3: Smart Inference Utility — String Items → Structured Timeline

This is the core mapping function that converts `parsedItinerary.items[]` (plain strings like "機場接機", "脆皮豬午餐") into structured items with `kind`, `icon`, and estimated `time`.

**Files:**
- Create: `src/lib/quote/inferTimelineItem.ts`
- Create: `src/lib/quote/__tests__/inferTimelineItem.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/quote/__tests__/inferTimelineItem.test.ts
import { inferTimelineItem, type TimelineItem } from '../inferTimelineItem'

describe('inferTimelineItem', () => {
  it('detects airport pickup as transport', () => {
    const result = inferTimelineItem('機場接機', 0, 0)
    expect(result.kind).toBe('transport')
    expect(result.icon).toBe('Car')
  })

  it('detects meal keywords', () => {
    const result = inferTimelineItem('脆皮豬午餐', 0, 2)
    expect(result.kind).toBe('meal')
    expect(result.icon).toBe('UtensilsCrossed')
  })

  it('detects activity keywords', () => {
    const result = inferTimelineItem('大象保護營 半日體驗', 0, 1)
    expect(result.kind).toBe('activity')
  })

  it('detects accommodation/hotel', () => {
    const result = inferTimelineItem('Check in 飯店', 0, 5)
    expect(result.kind).toBe('stop')
  })

  it('assigns sequential times based on item index', () => {
    const items = ['機場接機', '換匯', '午餐', '泰服體驗', '芒果糯米飯', '晚餐']
    const results = items.map((item, i) => inferTimelineItem(item, 0, i))
    // Times should be sequential and reasonable
    expect(results[0].time).toBeDefined()
    expect(results.every(r => /^\d{2}:\d{2}$/.test(r.time))).toBe(true)
  })

  it('returns activity as default kind', () => {
    const result = inferTimelineItem('某個不知名景點', 0, 0)
    expect(result.kind).toBe('activity')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
npx jest src/lib/quote/__tests__/inferTimelineItem.test.ts --no-cache
```

**Step 3: Implement inferTimelineItem**

```typescript
// src/lib/quote/inferTimelineItem.ts
export type ItemKind = 'transport' | 'meal' | 'snack' | 'activity' | 'stop'

export interface TimelineItem {
  label: string
  kind: ItemKind
  icon: string
  time: string
}

const TRANSPORT_KEYWORDS = ['接機', '送機', '機場', '出發', 'check out', 'checkout', '車程', '搭車', '前往']
const MEAL_KEYWORDS = ['午餐', '晚餐', '早餐', '用餐', '餐廳', '吃到飽', '火鍋', '燒烤', 'buffet', '米其林', '帝王餐']
const SNACK_KEYWORDS = ['下午茶', '甜點', '咖啡', '冰淇淋', '芒果', '奶茶', '點心']
const STOP_KEYWORDS = ['check in', 'checkin', '飯店', '入住', '採買', '商場', '市場', '換匯', '超市', 'Big C', '7-11', '紀念品']

const KIND_ICON_MAP: Record<ItemKind, string> = {
  transport: 'Car',
  meal: 'UtensilsCrossed',
  snack: 'Coffee',
  activity: 'Sparkles',
  stop: 'MapPin',
}

// Special icon overrides based on keywords
const ICON_OVERRIDES: [RegExp, string][] = [
  [/接機|送機|機場|航班|飛機/, 'Plane'],
  [/大象/, 'Heart'],
  [/瀑布|水上|泳/, 'Droplets'],
  [/動物園|safari/, 'Moon'],
  [/夜市/, 'ShoppingBag'],
  [/寺|廟|temple/, 'Building'],
  [/攀岩|冒險|繩索|溜索/, 'MountainSnow'],
  [/泰服|拍照|攝影/, 'Camera'],
  [/按摩|spa|SPA/, 'Heart'],
  [/換匯/, 'Coins'],
]

// Generate reasonable time based on item index within a day
// Assumes day starts ~08:00-09:00, items spread across 10 hours
function estimateTime(dayIndex: number, itemIndex: number, kind: ItemKind): string {
  // First day with airport arrival starts later
  const baseHour = itemIndex === 0 && kind === 'transport' ? 8 : 9
  // Spread items across the day with ~1.5-2 hour gaps
  const hour = Math.min(baseHour + Math.floor(itemIndex * 1.8), 21)
  const minute = (itemIndex % 2 === 0) ? 0 : 30
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function detectKind(text: string): ItemKind {
  const lower = text.toLowerCase()
  if (TRANSPORT_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'transport'
  if (MEAL_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'meal'
  if (SNACK_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'snack'
  if (STOP_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) return 'stop'
  return 'activity'
}

function detectIcon(text: string, kind: ItemKind): string {
  for (const [pattern, icon] of ICON_OVERRIDES) {
    if (pattern.test(text)) return icon
  }
  return KIND_ICON_MAP[kind]
}

export function inferTimelineItem(
  text: string,
  dayIndex: number,
  itemIndex: number,
): TimelineItem {
  const kind = detectKind(text)
  const icon = detectIcon(text, kind)
  const time = estimateTime(dayIndex, itemIndex, kind)
  return { label: text, kind, icon, time }
}
```

**Step 4: Run test to verify it passes**

```bash
npx jest src/lib/quote/__tests__/inferTimelineItem.test.ts --no-cache
```

**Step 5: Commit**

```bash
git add src/lib/quote/
git commit -m "feat: 行程項目智慧推斷函數（kind/icon/time）"
```

---

### Task 4: Shared Types & Sanity Query

**Files:**
- Create: `src/lib/quote/types.ts`
- Create: `src/lib/quote/fetchQuote.ts`

**Step 1: Define shared types**

```typescript
// src/lib/quote/types.ts
import type { TimelineItem } from './inferTimelineItem'

export interface QuotePhoto {
  dayIndex: number
  images: {
    asset: { _ref: string }
    hotspot?: { x: number; y: number }
  }[]
}

export interface QuoteData {
  // Metadata
  name: string
  publicSlug: string
  createdAt: string
  updatedAt?: string

  // Trip info
  adults: number
  children: number
  tripDays: number
  tripNights: number
  exchangeRate: number

  // Itinerary
  itinerary: {
    day: string
    title: string
    items: TimelineItem[]
    hotel: string | null
  }[]

  // Pricing (ExternalQuoteBreakdown)
  quote: {
    items: { label: string; amountTHB: number; amountTWD: number; description?: string }[]
    included: string[]
    excluded: string[]
    paymentNotes: string[]
    totalTHB: number
    totalTWD: number
  }

  // Payment
  collectDeposit: boolean
  hotelsWithDeposit: { name: string; deposit: number; rooms: number }[]
  totalDeposit: number
  carCount: number

  // Photos
  photos: QuotePhoto[]

  // Mode
  isSample: boolean
}
```

**Step 2: Implement Sanity fetch function**

```typescript
// src/lib/quote/fetchQuote.ts
import { client } from '@/sanity/lib/client'
import { inferTimelineItem } from './inferTimelineItem'
import { buildExternalQuoteBreakdown } from '@/sanity/tools/pricing/externalQuote'
import { buildQuoteItinerary } from '@/sanity/tools/pricing/quoteDetails'
import type { QuoteData } from './types'

const SAMPLE_SLUG = 'sample'

const QUERY = `*[_type == "pricingExample" && publicSlug.current == $slug][0]{
  name,
  "publicSlug": publicSlug.current,
  createdAt,
  updatedAt,
  payload,
  "photos": photos[]{
    dayIndex,
    "images": images[]{
      asset->{_id, url},
      hotspot
    }
  }
}`

export async function fetchQuoteBySlug(slug: string): Promise<QuoteData | null> {
  const doc = await client.fetch(QUERY, { slug })
  if (!doc?.payload) return null

  const saved = JSON.parse(doc.payload)
  const data = saved.data ?? saved

  const adults = data.adults ?? data.people ?? 2
  const children = data.children ?? 0
  const carFees = data.carFees ?? []
  const tripDays = carFees.length || 1
  const tripNights = Math.max(tripDays - 1, 0)
  const exchangeRate = data.exchangeRate ?? 1.1
  const hotels = data.hotels ?? []
  const includeAccommodation = data.includeAccommodation ?? false

  // Build itinerary with smart inference
  const rawItinerary = buildQuoteItinerary({
    parsedItinerary: data.parsedItinerary ?? [],
    carFees,
    tripDays,
    includeAccommodation,
    hotels,
  })

  const itinerary = rawItinerary.map((day, dayIndex) => ({
    ...day,
    items: day.items.map((item: string, itemIndex: number) =>
      inferTimelineItem(item, dayIndex, itemIndex)
    ),
  }))

  // Build external quote breakdown
  // (Reconstruct the input from saved data — see PricingCalculator for reference)
  // This will be refined during implementation by reading the exact calculation logic
  const isSample = slug === SAMPLE_SLUG

  return {
    name: doc.name,
    publicSlug: doc.publicSlug,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    adults,
    children,
    tripDays,
    tripNights,
    exchangeRate,
    itinerary,
    quote: null as any, // Will be computed from saved calculation snapshot
    collectDeposit: false, // From saved data
    hotelsWithDeposit: [],
    totalDeposit: 0,
    carCount: carFees.length > 0 ? 1 : 0,
    photos: doc.photos ?? [],
    isSample,
  }
}
```

> **Implementation Note:** The exact `quote` reconstruction from saved payload needs careful reading of PricingCalculator's calculation memo (~line 2540-2830). The plan captures the structure; implementation will trace the exact fields. Consider storing the pre-computed `ExternalQuoteBreakdown` in the payload at save time to avoid re-computation.

**Step 3: Commit**

```bash
git add src/lib/quote/
git commit -m "feat: 報價展示頁共用型別 + Sanity 查詢函數"
```

---

## Phase 2: Quote Page Frontend

### Task 5: Page Route & Layout Shell

**Files:**
- Create: `src/app/quote/[slug]/page.tsx`
- Create: `src/app/quote/[slug]/layout.tsx`

**Step 1: Create layout with noindex**

```typescript
// src/app/quote/[slug]/layout.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

**Step 2: Create page shell**

```typescript
// src/app/quote/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { fetchQuoteBySlug } from '@/lib/quote/fetchQuote'
import { QuotePageClient } from './QuotePageClient'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function QuotePage({ params }: Props) {
  const { slug } = await params
  const quote = await fetchQuoteBySlug(slug)
  if (!quote) notFound()

  return <QuotePageClient quote={quote} />
}
```

**Step 3: Create client wrapper (animation provider)**

```typescript
// src/app/quote/[slug]/QuotePageClient.tsx
'use client'

import type { QuoteData } from '@/lib/quote/types'
import { QuoteHero } from '@/components/quote/QuoteHero'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { QuoteFooter } from '@/components/quote/QuoteFooter'

export function QuotePageClient({ quote }: { quote: QuoteData }) {
  return (
    <main className="grain" style={{ background: '#FDFBF4', minHeight: '100vh' }}>
      <QuoteHero quote={quote} />
      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <QuoteFooter isSample={quote.isSample} />
    </main>
  )
}
```

**Step 4: Commit**

```bash
git add src/app/quote/
git commit -m "feat: /quote/[slug] 路由骨架 + noindex"
```

---

### Task 6: Hero Component

Port the Claude Design Hero, replacing hardcoded content with dynamic quote data.

**Files:**
- Create: `src/components/quote/QuoteHero.tsx`

**Key binding:**
- Sample mode: "您的清邁之旅" + "5天4夜親子精緻行程" + generic subtitle
- Customer mode: "{name}" + traveler summary + date range

**Visual reference:** Claude Design HTML lines 282-330 (Hero component)

**Step 1: Implement QuoteHero**

Port the Hero from Claude Design HTML. Key changes:
- Replace `清邁親子五日精緻路徑手冊` with dynamic title
- Replace hardcoded itinerary number with `quote.publicSlug`
- Customer mode: show name, adults/children, date range from carFees
- Sample mode: show generic "以一家四口為例" tagline
- Keep BrandStrip, gradient background, dash animation, LINE CTA button
- Use `lucide-react` instead of UMD lucide

**Step 2: Commit**

```bash
git add src/components/quote/QuoteHero.tsx
git commit -m "feat: QuoteHero 元件（動態客戶資料 + sample 模式）"
```

---

### Task 7: Itinerary Section — Path Overview + Day Detail

This is the largest component. Port Claude Design's PathOverview + DayDetail with dynamic data.

**Files:**
- Create: `src/components/quote/QuoteItinerary.tsx`
- Create: `src/components/quote/DayTimeline.tsx`
- Create: `src/components/quote/DayPhotos.tsx`

**Visual reference:** Claude Design HTML lines 332-900+

**Key binding:**
- `ITINERARY[].day/title` ← `quote.itinerary[].day/title`
- `ITINERARY[].items[]` ← `quote.itinerary[].items[]` (already inferred with kind/icon/time)
- `ITINERARY[].hero` (color) ← auto-assign from palette: `['#E8A23B', '#4A6B3A', '#A8C8DC', '#CA8A04', '#B85C38']` cycling
- `ITINERARY[].glyph` (emoji) ← auto-assign from day title keywords or index
- Photos ← `quote.photos[dayIndex].images[]` (Sanity image URLs)

**Step 1: QuoteItinerary — Path Overview (day circles + expand)**

Port PathOverview with PathNode (desktop) and PathNodeMobile. Data from `quote.itinerary[]`.

Auto-assign glyph per day:
```typescript
const DAY_GLYPHS = ['🛬', '🐘', '🏊', '🎢', '✈️', '🏔️', '🌴', '🎪']
// Use index, or keyword match from title
```

**Step 2: DayTimeline — Expanded day detail with time/icon/kind chips**

Port the timeline items section. Each item from `quote.itinerary[].items[]` (TimelineItem) renders:
- Time badge (left)
- Kind chip (transport/meal/activity/stop/snack) with color
- Icon (lucide)
- Label text

Use `kindMeta` from Claude Design HTML line 245-251 for chip styles.

**Step 3: DayPhotos — Horizontal scroll photo cards**

For each day, if `quote.photos` has images for that `dayIndex`:
- Mobile: horizontal scroll of up to 3 photo cards
- Desktop: PhotoWaypoints style (silk path + polaroid) from Claude Design

If no photos for a day, skip the photo section entirely.

Use Sanity image URL builder for responsive images.

**Step 4: Commit**

```bash
git add src/components/quote/QuoteItinerary.tsx src/components/quote/DayTimeline.tsx src/components/quote/DayPhotos.tsx
git commit -m "feat: 行程區元件（Path Overview + 時間軸 + 照片）"
```

---

### Task 8: Cost Dashboard Component

Port Claude Design's CostDashboard, binding ExternalQuoteBreakdown data.

**Files:**
- Create: `src/components/quote/QuoteCostDashboard.tsx`

**Visual reference:** Claude Design HTML lines 1010-1145

**Sections (6 blocks):**

1. **費用包含 / 不含** — Claude Design glass cards
   - Data: `quote.quote.included[]` / `excluded[]`
   - Auto-assign icons based on keywords (similar to inferTimelineItem)

2. **逐項明細** — NEW section in Claude Design style
   - Data: `quote.quote.items[]` with label, amountTHB, amountTWD, description
   - Style: card list with dashed separators (like ExternalQuoteTab but prettier)

3. **總報價** — Claude Design dark card
   - Data: `quote.quote.totalTWD` (big number) + `quote.quote.totalTHB`
   - Sample mode: add "參考報價・以一家四口為例" + "實際費用依人數與行程客製"

4. **付款說明 + 超時費** — NEW section
   - Data: `quote.quote.paymentNotes[]`
   - Overtime: 300 THB/hour × carCount (hardcode the new rate)
   - Sample mode: hide this section

5. **匯款帳號** — NEW section
   - Data: `TWD_TRANSFER_ACCOUNT` from quoteDetails.ts
   - Sample mode: hide this section

6. **住宿押金** — conditional
   - Data: `quote.hotelsWithDeposit[]`, `quote.totalDeposit`
   - Only show if `collectDeposit && hotelsWithDeposit.length > 0`
   - Sample mode: hide

**Step 1: Implement QuoteCostDashboard with all 6 sections**

**Step 2: Commit**

```bash
git add src/components/quote/QuoteCostDashboard.tsx
git commit -m "feat: 報價區元件（明細 + 包含/不含 + 付款 + 匯款）"
```

---

### Task 9: Footer + LINE CTA

**Files:**
- Create: `src/components/quote/QuoteFooter.tsx`

**Step 1: Implement footer**

- Big LINE CTA button (always visible)
- Sample mode: "LINE 聊聊行程" (inquiry)
- Customer mode: "LINE 確認這份報價" (confirmation)
- Brand strip at bottom
- "Powered by 清微旅行" subtle text

**Step 2: Commit**

```bash
git add src/components/quote/QuoteFooter.tsx
git commit -m "feat: QuoteFooter + LINE CTA"
```

---

## Phase 3: PricingCalculator Integration

### Task 10: Photo Upload UI in PricingCalculator

Add photo upload per day in the pricing calculator.

**Files:**
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`

**Step 1: Add photo state and upload handler**

- Add `photos` state: `Record<number, SanityImageAsset[]>` (dayIndex → images)
- Add upload function using Sanity client `client.assets.upload('image', file)`
- Add UI: under each day's itinerary card, show "上傳照片" dropzone
- Max 3 images per day, with preview thumbnails and delete button
- Include photos in the saved quote payload

**Step 2: Modify save logic to include photos**

When saving to Sanity, include photos in the pricingExample document (not just in payload JSON).

**Step 3: Commit**

```bash
git add src/sanity/tools/pricing/PricingCalculator.tsx
git commit -m "feat: 報價計算器加入每日照片上傳功能"
```

---

### Task 11: "Generate Link" Button

Replace/augment the "download PDF" button with "generate link".

**Files:**
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`

**Step 1: Add generatePublicLink function**

```typescript
async function generatePublicLink(quoteId: string) {
  // 1. Generate a short slug (nanoid 8 chars)
  // 2. Patch the Sanity document: set publicSlug
  // 3. Also save the computed ExternalQuoteBreakdown snapshot in payload
  // 4. Return the URL: `${window.location.origin}/quote/${slug}`
}
```

**Step 2: Add UI button next to existing PDF download**

- Button text: "📎 產生報價連結"
- On click: generate slug → save to Sanity → show URL with copy button
- If slug already exists, show existing URL
- Copy to clipboard functionality

**Step 3: Commit**

```bash
git add src/sanity/tools/pricing/PricingCalculator.tsx
git commit -m "feat: 報價計算器「產生報價連結」按鈕"
```

---

### Task 12: Store ExternalQuoteBreakdown Snapshot

To avoid re-computing the quote breakdown on the public page, store it at save time.

**Files:**
- Modify: `src/sanity/tools/pricing/PricingCalculator.tsx`

**Step 1: When generating link, compute and store breakdown**

Add to the save payload:
```typescript
{
  ...existingPayload,
  _quoteSnapshot: {
    externalQuote: buildExternalQuoteBreakdown(input),
    collectDeposit,
    hotelsWithDeposit: [...],
    totalDeposit,
    carCount,
  }
}
```

**Step 2: Update fetchQuote to read snapshot**

In `src/lib/quote/fetchQuote.ts`, read `_quoteSnapshot` from payload instead of re-computing.

**Step 3: Commit**

```bash
git add src/sanity/tools/pricing/PricingCalculator.tsx src/lib/quote/fetchQuote.ts
git commit -m "feat: 儲存報價快照，展示頁直接讀取"
```

---

## Phase 4: Polish & Verification

### Task 13: Mobile Responsive Testing

- Test all components at 375px, 414px, 768px widths
- Verify horizontal photo scroll works on touch
- Verify Path Overview switches to mobile vertical layout
- Verify Cost Dashboard stacks to single column

### Task 14: Sample Mode End-to-End

- Set publicSlug on the "清邁親子5天4夜經典套餐" document to "sample"
- Visit `/quote/sample` and verify:
  - Generic hero (no customer name)
  - Full itinerary with smart inference
  - Pricing shows "參考" label
  - No payment details / bank account
  - LINE CTA says "聊聊行程"

### Task 15: Customer Mode End-to-End

- Create a test quote in PricingCalculator
- Click "產生報價連結"
- Visit the generated URL and verify:
  - Customer name in hero
  - Full pricing breakdown
  - Payment details + bank account
  - LINE CTA says "確認這份報價"

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Backend: schema, types, utilities, overtime fix |
| 2 | 5-9 | Frontend: page route + all visual components |
| 3 | 10-12 | Integration: photo upload + generate link + snapshot |
| 4 | 13-15 | Polish: responsive + E2E both modes |

**Key Dependencies:**
- Task 3 (smart inference) blocks Task 7 (itinerary rendering)
- Task 4 (types/fetch) blocks Task 5 (page route)
- Task 2 (schema) blocks Task 10 (photo upload) and Task 11 (generate link)
- Task 12 (snapshot) blocks Task 14-15 (E2E testing)
