import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PUBLIC_SOURCE_ALLOWLIST = [
  'src/app/cancellation/page.tsx',
  'src/app/terms/page.tsx',
  'src/components/quote/QuoteCostDashboard.tsx',
  'src/app/layout.tsx',
  'src/app/page.tsx',
  'src/app/services/car-charter/page.tsx',
  'src/lib/brand-entity.ts',
  'src/lib/home-public-copy.ts',
  'src/lib/pricing/publicCopy.ts',
  'src/lib/site-settings.ts',
  'src/sanity/schemas/siteSettings.ts',
  'src/components/sections/Hero.tsx',
  'src/components/Footer.tsx',
  'src/components/sections/WhoWeAre.tsx',
  'src/components/sections/WhyUs.tsx',
  'src/components/sections/Services.tsx',
  'src/components/sections/CTA.tsx',
  'src/components/schema/HomePageFaqSchema.tsx',
  'src/components/cms/PerPersonPricingTable.tsx',
  // Testimonials is intentionally excluded: verified customer wording stays verbatim;
  // a separate render test requires the staffing-context disclaimer beside it.
] as const

interface ForbiddenCopy {
  label: string
  pattern: RegExp
}

const FORBIDDEN_COPY: ForbiddenCopy[] = [
  {
    label: '正面中文司機承諾',
    pattern: /中文司機|司機\s*(?:都|皆|也)?\s*(?:會|能|可以)\s*(?:說)?中文/g,
  },
  {
    label: '8 人與未證實法規綁定',
    pattern: /(?:8\s*人[^。；\n]{0,24}(?:依法|法規|法律)|(?:依法|法規|法律)[^。；\n]{0,24}8\s*人)/g,
  },
  {
    label: '司機與導遊各 THB 200 超時費',
    pattern: /各\s*(?:THB|泰銖)?\s*200|司機[^。；\n]{0,24}200[^。；\n]{0,36}導遊[^。；\n]{0,24}200/g,
  },
  {
    label: 'THB 400 每小時舊超時費',
    pattern: /(?:THB\s*)?400\s*(?:泰銖)?\s*[\/／]?\s*(?:小時|時)/g,
  },
  {
    label: '兒童座椅宣稱免費',
    pattern: /(?:兒童|嬰兒)(?:安全)?座椅[^。；\n]{0,20}免費|免費[^。；\n]{0,20}(?:兒童|嬰兒)(?:安全)?座椅/g,
  },
  {
    label: '兒童座椅列入標準包含',
    pattern: /包車服務包含[：:]?[\s\S]{0,420}(?:兒童|嬰兒)(?:安全)?座椅|(?:標準|基本)(?:服務|方案)?[^。；\n]{0,20}(?:包含|含)[^。；\n]{0,40}(?:兒童|嬰兒)(?:安全)?座椅/g,
  },
  {
    label: '現行包車 priceRange 使用 NT$ 舊價',
    pattern: /priceRange\s*:\s*['"`]\s*(?:NT\$|NTD|新台幣)/g,
  },
  {
    label: '現行包車 metadata 使用 NT$ 舊價',
    pattern: /(?:description|socialDescription)\s*:\s*['"`](?:[^'"`\n]{0,180}(?:NT\$|NTD|新台幣)[^'"`\n]{0,80}(?:包車|每人|每日)|[^'"`\n]{0,180}(?:包車|每人|每日)[^'"`\n]{0,80}(?:NT\$|NTD|新台幣))/g,
  },
]

function readPublicSources() {
  return PUBLIC_SOURCE_ALLOWLIST.map((relativePath) => ({
    relativePath,
    source: readFileSync(resolve(process.cwd(), relativePath), 'utf8')
      // Negative education is intentional: it sets expectations without promising a Chinese-speaking driver.
      .replace(/(?:不是|並非)中文司機/g, '非中文服務司機')
      .replace(/司機會說中文嗎[？?]?/g, '司機中文服務說明'),
  }))
}

describe('production public copy tripwire', () => {
  it('keeps retired driver, overtime, child-seat and NT$ promises out of current public sources', () => {
    const violations = readPublicSources().flatMap(({ relativePath, source }) =>
      FORBIDDEN_COPY.flatMap(({ label, pattern }) => {
        const matches = Array.from(source.matchAll(new RegExp(pattern.source, pattern.flags)))
        return matches.map((match) => `${relativePath}: ${label}: ${match[0].replace(/\s+/g, ' ').trim()}`)
      })
    )

    expect(violations).toEqual([])
  })
})
